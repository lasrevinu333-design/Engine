package org.memphiszoo.custodial.vault;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.net.ssl.HttpsURLConnection;

/** Test-only raw loopback loan to Root's owned isolated SQL server. NOT TLS.
 * The production URL/path stays fixed; actual native headers (including BOTH
 * original credential headers and all HMAC/purpose fields) and exact request
 * bytes are forwarded untouched. No credential reconstruction/response JSON
 * rewrite/native journal constructor/clock override. Fresh GMD process only.
 */
final class NativeScanSqlLoanHttpsFixture implements AutoCloseable {
    private static final int MAX=1_048_576, HEADER_MAX=16_384, TRANSPORT_MS=3_000;
    private final int port;
    private boolean installed,closed;
    private final List<Socket> sockets=new ArrayList<>();
    private int exchanges;
    private final List<Observation> observations=new ArrayList<>();
    static final class Observation {
        final String path,method,function,requestSha256,responseSha256;final int status;
        Observation(String path,String method,String fn,int status,String request,String response){
            this.path=path;this.method=method;function=fn;this.status=status;requestSha256=request;responseSha256=response;
        }
    }
    synchronized List<Observation> observations(){return List.copyOf(observations);}
    private static String observedFunction(byte[] bytes){
        try{String fn=ProviderWireJson.object(bytes,MAX).optString("fn","");
            return List.of("tool_get_offline_scan_authority_snapshot","tool_start_offline_occurrence","tool_commit_cleaning_workflow").contains(fn)?fn:"OTHER";
        }catch(Exception unavailable){return "OTHER";}
    }
    private static String digest(byte[] bytes)throws IOException {
        try{byte[] hash=java.security.MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder value=new StringBuilder(64);
            for(byte b:hash)value.append(String.format(Locale.ROOT,"%02x",b&255));return value.toString();}
        catch(java.security.NoSuchAlgorithmException missing){throw new IOException("SHA-256 unavailable",missing);}
    }

    NativeScanSqlLoanHttpsFixture(int ownedLoopbackPort) {
        if(ownedLoopbackPort<1||ownedLoopbackPort>65535)throw new IllegalArgumentException("Owned port required");
        port=ownedLoopbackPort;
    }
    synchronized void installBeforeDefaultRuntime() {
        if(installed||closed)throw new IllegalStateException("Fresh test transport required");installed=true;
        URL.setURLStreamHandlerFactory(protocol->"https".equals(protocol)?new URLStreamHandler(){
            @Override protected URLConnection openConnection(URL url)throws IOException {
                synchronized(NativeScanSqlLoanHttpsFixture.this){
                    if(closed||!"https".equals(url.getProtocol())||!"memphis-zoo-mcp.onrender.com".equals(url.getHost())
                        ||url.getPort()!=-1||url.getUserInfo()!=null||url.getRef()!=null)
                        throw new IOException("Owned fixed original URL refused");
                }
                return new Connection(url);
            }
        }:null);
    }
    synchronized int actualRawExchanges(){return exchanges;}
    @Override public synchronized void close(){
        if(closed)return;closed=true;
        for(Socket socket:sockets)try{socket.close();}catch(IOException ignored){}
        sockets.clear();
    }
    private static final class WipeBuffer extends ByteArrayOutputStream {
        @Override public synchronized void write(byte[] b,int off,int len){
            if(len<0||count>MAX-len)throw new IllegalStateException("Original request byte bound");super.write(b,off,len);
        }
        @Override public synchronized void write(int b){if(count>=MAX)throw new IllegalStateException("Original request byte bound");super.write(b);}
        synchronized void wipe(){Arrays.fill(buf,(byte)0);reset();}
    }
    private static String ascii(String value)throws IOException {
        if(value==null||value.isEmpty()||value.length()>8192)throw new IOException("Original header bound");
        for(int i=0;i<value.length();i++)if(value.charAt(i)<32||value.charAt(i)>126)throw new IOException("Original header type");
        return value;
    }
    private static int remaining(long deadline)throws IOException {
        long left=deadline-System.nanoTime();if(left<=0)throw new IOException("Owned original transport expired");
        return (int)Math.max(1,Math.min(TRANSPORT_MS,(left+999_999L)/1_000_000L));
    }
    private static String line(InputStream input,Socket socket,long deadline,int[] total)throws IOException {
        ByteArrayOutputStream result=new ByteArrayOutputStream();boolean cr=false;
        while(true){socket.setSoTimeout(remaining(deadline));int b=input.read();
            if(b<0||++total[0]>HEADER_MAX)throw new IOException("Original response header incomplete/bounded");
            if(cr){if(b!='\n')throw new IOException("Original response header framing");return result.toString(StandardCharsets.US_ASCII.name());}
            if(b=='\r')cr=true;else {if(b<32||b>126)throw new IOException("Original response header type");result.write(b);}
        }
    }
    private final class Connection extends HttpsURLConnection {
        private final Map<String,String> originalHeaders=new LinkedHashMap<>();
        private final Map<String,List<String>> receivedHeaders=new LinkedHashMap<>();
        private final WipeBuffer sent=new WipeBuffer();
        private byte[] response;
        private int status=-1;
        private boolean attempted;
        private Socket active;
        Connection(URL url){super(url);}
        @Override public void setRequestProperty(String key,String value){
            if(attempted)throw new IllegalStateException("Original exchange already attempted");
            if(originalHeaders.containsKey(key))throw new IllegalStateException("Duplicate original header");
            originalHeaders.put(key,value);
        }
        @Override public OutputStream getOutputStream(){return sent;}
        @Override public int getResponseCode()throws IOException {
            synchronized(this){if(attempted)throw new IOException("Original exchange already attempted or unknown");attempted=true;}
            byte[] body=sent.toByteArray();long deadline=System.nanoTime()+TRANSPORT_MS*1_000_000L;
            try {
                synchronized(NativeScanSqlLoanHttpsFixture.this){
                    if(closed||++exchanges>16)throw new IOException("Owned original exchange closed/bounded");
                }
                // The sole Root-owned GMD reverse may become ready after test
                // startup. Poll connection readiness ONLY before writing ANY
                // request byte, within this SAME original absolute3s deadline.
                // Once connected, the original request/response is attempted
                // exactly once; no HTTP/auth/SQL/result retry is permitted.
                for(;;){
                    synchronized(NativeScanSqlLoanHttpsFixture.this){
                        if(closed)throw new IOException("Owned transport closed");
                        active=new Socket();sockets.add(active);
                    }
                    try{active.connect(new InetSocketAddress("127.0.0.1",port),remaining(deadline));break;}
                    catch(java.net.ConnectException notReady){
                        try{active.close();}finally{synchronized(NativeScanSqlLoanHttpsFixture.this){sockets.remove(active);}}
                        int wait=Math.min(25,remaining(deadline));
                        try{Thread.sleep(wait);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new IOException("Owned readiness interrupted",interrupted);}
                    }
                }
                String method=getRequestMethod();if(!"POST".equals(method)&&!"GET".equals(method))throw new IOException("Original method refused");
                String target=ascii(url.getFile());if(!target.startsWith("/")||target.indexOf(' ')>=0)throw new IOException("Original path refused");
                StringBuilder head=new StringBuilder(method).append(' ').append(target).append(" HTTP/1.1\r\n");
                boolean contentLength=false,host=false;java.util.HashSet<String> names=new java.util.HashSet<>();
                for(Map.Entry<String,String> entry:originalHeaders.entrySet()){
                    String key=ascii(entry.getKey()),value=ascii(entry.getValue()),lower=key.toLowerCase(Locale.ROOT);
                    if(!key.matches("[A-Za-z0-9-]+")||!names.add(lower))throw new IOException("Original duplicate/header name refused");
                    if(lower.equals("transfer-encoding")||lower.equals("connection"))throw new IOException("Original framing header refused");
                    if(lower.equals("content-length")){if(!value.equals(Integer.toString(body.length)))throw new IOException("Original length mismatch");contentLength=true;}
                    if(lower.equals("host")){if(!value.equals(url.getHost()))throw new IOException("Original host mismatch");host=true;}
                    head.append(key).append(": ").append(value).append("\r\n");
                }
                if(!host)head.append("Host: ").append(url.getHost()).append("\r\n");
                if(!contentLength)head.append("Content-Length: ").append(body.length).append("\r\n");
                head.append("Connection: close\r\n\r\n");byte[] prefix=head.toString().getBytes(StandardCharsets.US_ASCII);
                if(prefix.length>HEADER_MAX)throw new IOException("Original request header bound");
                OutputStream output=active.getOutputStream();try{output.write(prefix);output.write(body);output.flush();}finally{Arrays.fill(prefix,(byte)0);}
                InputStream input=active.getInputStream();int[] headerBytes={0};String first=line(input,active,deadline,headerBytes);
                if(!first.matches("HTTP/1\\.[01] [1-5][0-9]{2} [ -~]*"))throw new IOException("Original response status framing");
                status=Integer.parseInt(first.substring(9,12));int length=-1;
                for(String header;(header=line(input,active,deadline,headerBytes)).length()>0;){
                    int colon=header.indexOf(':');if(colon<=0)throw new IOException("Original response header framing");
                    String key=header.substring(0,colon).toLowerCase(Locale.ROOT),value=header.substring(colon+1).trim();
                    if(key.equals("transfer-encoding"))throw new IOException("Unowned chunked response refused");
                    if(key.equals("content-length")){
                        if(length>=0||!value.matches("0|[1-9][0-9]{0,6}"))throw new IOException("Original response length refused");
                        length=Integer.parseInt(value);if(length>MAX)throw new IOException("Original response byte bound");
                    }
                    receivedHeaders.computeIfAbsent(key,k->new ArrayList<>()).add(value);
                }
                if(length<0)throw new IOException("Original response length missing");response=new byte[length];
                for(int offset=0;offset<length;){active.setSoTimeout(remaining(deadline));int n=input.read(response,offset,length-offset);
                    if(n<0)throw new IOException("Original response body truncated");offset+=n;}
                synchronized(NativeScanSqlLoanHttpsFixture.this){observations.add(new Observation(url.getFile(),method,observedFunction(body),status,digest(body),digest(response)));}
                return status;
            }finally{
                Arrays.fill(body,(byte)0);sent.wipe();
                if(active!=null){try{active.close();}finally{synchronized(NativeScanSqlLoanHttpsFixture.this){sockets.remove(active);}}}
            }
        }
        @Override public InputStream getInputStream()throws IOException {if(response==null)throw new IOException("Original response not available");return new ByteArrayInputStream(response);}
        @Override public InputStream getErrorStream(){return response==null?null:new ByteArrayInputStream(response);}
        @Override public Map<String,List<String>> getHeaderFields(){
            Map<String,List<String>> result=new LinkedHashMap<>();for(Map.Entry<String,List<String>> row:receivedHeaders.entrySet())
                result.put(row.getKey(),Collections.unmodifiableList(new ArrayList<>(row.getValue())));return Collections.unmodifiableMap(result);
        }
        @Override public String getHeaderField(String key){if(key==null)return null;List<String> values=receivedHeaders.get(key.toLowerCase(Locale.ROOT));return values==null?null:values.get(0);}
        @Override public void disconnect(){if(active!=null)try{active.close();}catch(IOException ignored){}
            originalHeaders.clear();receivedHeaders.clear();sent.wipe();if(response!=null)Arrays.fill(response,(byte)0);response=null;}
        @Override public boolean usingProxy(){return false;}
        @Override public void connect(){}
        @Override public String getCipherSuite(){return "OWNED_ADB_REVERSE_RAW_NOT_TLS";}
        @Override public Certificate[] getLocalCertificates(){return null;}
        @Override public Certificate[] getServerCertificates(){return null;}
    }
}
