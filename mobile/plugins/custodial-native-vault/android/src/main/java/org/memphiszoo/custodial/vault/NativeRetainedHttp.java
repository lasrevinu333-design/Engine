package org.memphiszoo.custodial.vault;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.net.ssl.HttpsURLConnection;

/** Unmounted fixed-origin/fixed-route native retention transport. Consumes ONLY
 * a durable journal dispatch capability; has NO nonce generator, enrollment,
 * generic URL/body signing, JS API, automatic retry or acceptance effects.
 * Default connection uses normal platform TLS; no verifier/redirect override. */
final class NativeRetainedHttp {
    static final String ORIGIN="https://memphis-zoo-mcp.onrender.com";
    static final int MAX_RESPONSE=262144;
    interface Connections { HttpsURLConnection open(URL exact) throws Exception; }
    private final Connections connections;
    private final VaultClock clock;
    NativeRetainedHttp(){this(url->(HttpsURLConnection)url.openConnection(),System::currentTimeMillis);}
    /** Synthetic connection/time seam only; never a plugin/host configuration. */
    NativeRetainedHttp(Connections connections,VaultClock clock){
        if(connections==null||clock==null)throw new IllegalArgumentException("retained_HTTP_dependencies_required");
        this.connections=connections;this.clock=clock;
    }
    static final class Attempt {
        private final long deadline=System.nanoTime()+30_000_000_000L;
        private HttpsURLConnection active;
        private boolean canceled;
        synchronized void check() throws VaultFailure {
            if(canceled||Thread.currentThread().isInterrupted()||System.nanoTime()-deadline>=0)throw pending();
        }
        int timeout(int maximum) throws VaultFailure {
            check();return (int)Math.max(1,Math.min(maximum,(deadline-System.nanoTime()+999999L)/1000000L));
        }
        synchronized void attach(HttpsURLConnection connection) throws VaultFailure {
            check();if(active!=null)throw pending();active=connection;
        }
        synchronized void detach(HttpsURLConnection connection){if(active==connection)active=null;}
        /** Sticky denial only; safe for the lifecycle thread. The actual IO
         * owner still performs disconnect/detach and proves settlement. */
        synchronized void requestCancellation(){canceled=true;}
        void cancel(){HttpsURLConnection connection;synchronized(this){canceled=true;connection=active;}if(connection!=null)connection.disconnect();}
    }
    /** Bounded exact response bytes only. Even HTTP200 is NOT retained work,
     * semantic inventory, acknowledged transport outcome or key authority.
     * The independent typed readback verifier remains a separate stage. */
    static final class Exchange implements AutoCloseable {
        final int status;
        final String nativeRequestId,bodySha256;
        final boolean workAccepted=false,inventoryAcknowledged=false,keyRemovalAllowed=false;
        private final byte[] response;
        private boolean closed;
        private Exchange(int status,String id,String bodyHash,byte[] response){
            this.status=status;nativeRequestId=id;bodySha256=bodyHash;this.response=response.clone();
        }
        byte[] response() throws VaultFailure {if(closed)throw pending();return response.clone();}
        @Override public void close(){Arrays.fill(response,(byte)0);closed=true;}
    }
    Exchange send(NativeRetainedAttemptJournal.Dispatch dispatch,String device,char[] credential,Attempt attempt) throws VaultFailure {
        if(dispatch==null||attempt==null)throw pending();attempt.check();return prepared(dispatch.takeRequest(),device,credential,attempt);
    }
    Exchange query(NativeRetainedQueryJournal.Dispatch dispatch,String device,char[] credential,Attempt attempt) throws VaultFailure {
        if(dispatch==null||attempt==null)throw pending();attempt.check();return prepared(dispatch.takeRequest(),device,credential,attempt);
    }
    private Exchange prepared(AuthorizedRequest request,String device,char[] credential,Attempt attempt) throws VaultFailure {
        HttpsURLConnection connection=null;byte[] received=null;
        try {
            attempt.check();
            if(!NativeRetainedAttempt.PATH.equals(request.path)||!"POST".equals(request.method)||request.body.length<1
                ||request.body.length>NativeRetainedAttempt.MAX_BODY||!device.equals(VaultValidation.deviceId(device)))throw pending();
            String nonce=request.headers.get("X-Memphis-Native-Request-Id"),timestamp=request.headers.get("X-Memphis-Native-Request-Timestamp");
            long originalMillis=VaultTimestamps.epochMillis(timestamp,NativeRetainedAttempt.FAILURE);
            NativeRetainedAttempt.requireFresh(timestamp,clock.nowMillis());
            // Verify, never replace, the original prepared native headers.
            Map<String,String> original=NativeAttestation.requestHeaders(request,device,credential,nonce,originalMillis);
            if(!original.equals(request.headers))throw pending();
            URL exact=new URL(ORIGIN+NativeRetainedAttempt.PATH);
            connection=connections.open(exact);
            if(connection==null||!exact.toString().equals(connection.getURL().toString()))throw pending();
            attempt.attach(connection);connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(attempt.timeout(5000));connection.setReadTimeout(attempt.timeout(10000));
            connection.setUseCaches(false);connection.setRequestMethod("POST");connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(request.body.length);
            for(Map.Entry<String,String> header:request.headers.entrySet())connection.setRequestProperty(header.getKey(),header.getValue());
            connection.setRequestProperty("Content-Type","application/json; charset=utf-8");connection.setRequestProperty("Accept","application/json");
            connection.setRequestProperty("Origin","https://localhost");connection.setRequestProperty("X-Memphis-App-Edition","custodial");
            connection.setRequestProperty("X-Device-Id",device);
            String privateHeader=new String(credential);
            connection.setRequestProperty("Authorization","Device "+privateHeader);
            connection.setRequestProperty("X-Device-Credential",privateHeader);connection.setRequestProperty("X-Memphis-Device-Credential",privateHeader);
            privateHeader=null;attempt.check();NativeRetainedAttempt.requireFresh(timestamp,clock.nowMillis());
            try(OutputStream stream=connection.getOutputStream()){attempt.check();stream.write(request.body);}
            attempt.check();int status=connection.getResponseCode();if(status<100||status>599)throw pending();
            int types=0;String contentType=null;Map<String,List<String>> headers=connection.getHeaderFields();
            if(headers==null)throw pending();
            for(Map.Entry<String,List<String>> header:headers.entrySet())if(header.getKey()!=null&&"content-type".equals(header.getKey().toLowerCase(Locale.ROOT))){
                if(++types!=1||header.getValue()==null||header.getValue().size()!=1)throw pending();contentType=header.getValue().get(0);
            }
            received=read(status>=400?connection.getErrorStream():connection.getInputStream(),attempt);
            if(received.length>0){
                if(contentType==null||!contentType.toLowerCase(Locale.ROOT).matches("application/json(?:;\\s*charset=utf-8)?"))throw pending();
                Object parsed=ProviderWireJson.parse(received,MAX_RESPONSE);
                if(SecretScrubber.containsSecret(parsed,credential))throw new VaultFailure("custodial_native_secret_response_refused");
            }
            attempt.check();return new Exchange(status,nonce,NativeRetainedAttempt.hash(request.body),received);
        }catch(VaultFailure error){throw error;}
        catch(Exception error){throw new VaultFailure("custodial_retained_transport_outcome_unknown",error);}
        finally{
            if(request!=null)Arrays.fill(request.body,(byte)0);if(received!=null)Arrays.fill(received,(byte)0);
            if(connection!=null){attempt.detach(connection);connection.disconnect();}
        }
    }
    private static byte[] read(InputStream stream,Attempt attempt) throws Exception {
        if(stream==null)return new byte[0];byte[] buffer=new byte[8192];
        try(InputStream input=stream;WipedBuffer out=new WipedBuffer()){
            while(true){attempt.check();int n=input.read(buffer,0,Math.min(buffer.length,MAX_RESPONSE-out.size()+1));if(n<0)break;
                if(n>MAX_RESPONSE-out.size())throw pending();out.write(buffer,0,n);}
            return out.toByteArray();
        }finally{Arrays.fill(buffer,(byte)0);}
    }
    private static final class WipedBuffer extends ByteArrayOutputStream {
        @Override public void close(){Arrays.fill(buf,(byte)0);reset();}
    }
    private static VaultFailure pending(){return new VaultFailure("custodial_retained_transport_outcome_unknown");}
}
