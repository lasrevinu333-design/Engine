package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;

/** Owned DATA representation only. The journal caller must independently validate
 * original AEAD, plan, file identity, current owner and finite control. Neither
 * parsing, hashes nor local_preservation_only confer custody or effect rights. */
final class NativeOriginalBrowserJournalDocument {
    static final String FAILURE="custodial_original_browser_journal_document_invalid";
    private static final int MAX_DOCUMENT=1600000,CHUNK_BYTES=1048576;
    private NativeOriginalBrowserJournalDocument() {}

    static Owned decode(String raw,String expectedEntryKey,String expectedOperationId,String expectedPlanSha256,
                        JSONObject expectedOriginalBrowserBinding,JSONObject expectedFrameMetadata)throws VaultFailure {
        byte[] utf8=null,chunk=null;boolean transferred=false;
        try {
            boolean frame="browser_frame-0".equals(expectedEntryKey);
            if(!frame&&(expectedEntryKey==null||!expectedEntryKey.matches("browser_chunk-(?:[0-9]|[1-5][0-9]|6[0-3])")))throw failure();
            uuid(expectedOperationId);hashText(expectedPlanSha256);
            if(expectedOriginalBrowserBinding==null||!frame&&expectedFrameMetadata==null)throw failure();
            JSONObject binding=snapshot(expectedOriginalBrowserBinding,32768);
            validateBinding(binding);exact(binding,"operation_id",expectedOperationId);
            JSONObject expectedMetadata=expectedFrameMetadata==null?null:snapshot(expectedFrameMetadata,16384);
            if(expectedMetadata!=null)validateMetadata(expectedMetadata);
            utf8=boundedUtf8(raw);
            JSONObject doc=ProviderWireJson.object(utf8,MAX_DOCUMENT);
            NativeRetainedAttempt.keys(doc,"schema","entry_key","operation_id","plan_sha256","kind","original_browser_binding",
                "browser_value_frame","chunk_index","chunk_base64","local_preservation_only","inventory_acknowledged",
                "work_accepted","finalizer_allowed","key_removal");
            exact(doc,"schema","custodial.native-private-custody-exchange-evidence.v1");
            exact(doc,"entry_key",expectedEntryKey);exact(doc,"operation_id",expectedOperationId);
            exact(doc,"plan_sha256",expectedPlanSha256);exact(doc,"kind",frame?"BROWSER_FRAME":"BROWSER_CHUNK");
            if(doc.get("local_preservation_only")!=Boolean.TRUE)throw failure();
            for(String k:new String[]{"inventory_acknowledged","work_accepted","finalizer_allowed","key_removal"})denied(doc,k);
            JSONObject original=doc.getJSONObject("original_browser_binding"),metadata=doc.getJSONObject("browser_value_frame");
            validateBinding(original);validateMetadata(metadata);
            if(!ProviderWireJson.same(binding,original)
                ||expectedMetadata!=null&&!ProviderWireJson.same(expectedMetadata,metadata))throw failure();
            String encoded=text(doc,"chunk_base64");int index=-1;
            if(frame){
                if(doc.get("chunk_index")!=JSONObject.NULL||!encoded.isEmpty())throw failure();
                chunk=new byte[0];
            }else{
                index=integer(doc,"chunk_index",63);
                if(!expectedEntryKey.equals("browser_chunk-"+index)||index>=integer(metadata,"chunk_count",64)
                    ||encoded.isEmpty()||encoded.length()>4*((CHUNK_BYTES+2)/3))throw failure();
                chunk=Base64.getDecoder().decode(encoded);
                int size=integer(metadata,"byte_count",64*CHUNK_BYTES);
                if(chunk.length!=Math.min(CHUNK_BYTES,size-index*CHUNK_BYTES)
                    ||!Base64.getEncoder().encodeToString(chunk).equals(encoded)
                    ||!NativeRetainedAttempt.hash(chunk).equals(metadata.getJSONArray("chunk_sha256").get(index)))throw failure();
            }
            // Keep the originally detached comparisons; never adopt a changed
            // expected graph or parent after reading the document.
            if(!ProviderWireJson.same(binding,expectedOriginalBrowserBinding)
                ||expectedMetadata!=null&&!ProviderWireJson.same(expectedMetadata,expectedFrameMetadata))throw failure();
            Owned result=new Owned(frame,index,metadata.toString(),chunk);transferred=true;return result;
        }catch(Exception invalid){throw failure();}
        finally{if(utf8!=null)Arrays.fill(utf8,(byte)0);if(!transferred&&chunk!=null)Arrays.fill(chunk,(byte)0);}
    }

    private static JSONObject snapshot(JSONObject value,int maximum)throws Exception {
        String text=value.toString();if(text==null||text.length()>maximum)throw failure();return new JSONObject(text);
    }
    private static void validateBinding(JSONObject value)throws Exception {
        NativeRetainedAttempt.keys(value,"operation_id","frame_sha256","original_generation_id","native_mutation_stamp");
        uuid(text(value,"operation_id"));uuid(text(value,"original_generation_id"));hashText(text(value,"frame_sha256"));
        String stamp=text(value,"native_mutation_stamp");if(stamp.isEmpty()||stamp.length()>4096)throw failure();
    }
    private static void validateMetadata(JSONObject value)throws Exception {
        NativeRetainedAttempt.keys(value,"schema","encoding","observation_sha256","frame_sha256","byte_count","chunk_bytes",
            "chunk_count","record_count","session_storage_state","chunk_sha256","native_authority","durable_retention",
            "inventory_acknowledged","finalizer_allowed","key_removal");
        exact(value,"schema","custodial.browser-original-value-frame.v1");exact(value,"encoding","MZBRV001");
        hashText(text(value,"observation_sha256"));hashText(text(value,"frame_sha256"));
        for(String k:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"})denied(value,k);
        int bytes=integer(value,"byte_count",64*CHUNK_BYTES),count=integer(value,"chunk_count",64);
        if(bytes<56||integer(value,"chunk_bytes",CHUNK_BYTES)!=CHUNK_BYTES||count!=1+(bytes-1)/CHUNK_BYTES)throw failure();
        integer(value,"record_count",4096);String session=text(value,"session_storage_state");
        if(!"NOT_DECLARED_UNKNOWN".equals(session)&&!"CAPTURED_READ_ONLY_NOT_AUTHENTICATED".equals(session))throw failure();
        JSONArray hashes=value.getJSONArray("chunk_sha256");if(hashes.length()!=count)throw failure();
        for(int i=0;i<count;i++)hashText(hashes.get(i));
    }
    private static byte[] boundedUtf8(String raw)throws Exception {
        if(raw==null||raw.isEmpty()||raw.length()>MAX_DOCUMENT)throw failure();int count=0;
        for(int i=0;i<raw.length();i++){
            char c=raw.charAt(i);
            if(Character.isHighSurrogate(c)){
                if(++i>=raw.length()||!Character.isLowSurrogate(raw.charAt(i)))throw failure();count+=4;
            }else if(Character.isLowSurrogate(c))throw failure();
            else count+=c<128?1:c<2048?2:3;
            if(count>MAX_DOCUMENT)throw failure();
        }
        return raw.getBytes(StandardCharsets.UTF_8);
    }
    private static int integer(JSONObject value,String key,int maximum)throws Exception {
        Object n=value.get(key);if(!(n instanceof Integer)&&!(n instanceof Long))throw failure();
        long number=((Number)n).longValue();if(number<0||number>maximum)throw failure();return (int)number;
    }
    private static String text(JSONObject value,String key)throws Exception {Object s=value.get(key);if(!(s instanceof String))throw failure();return (String)s;}
    private static void exact(JSONObject value,String key,String expected)throws Exception{if(expected==null||!expected.equals(text(value,key)))throw failure();}
    private static void denied(JSONObject value,String key)throws Exception{if(value.get(key)!=Boolean.FALSE)throw failure();}
    private static void hashText(Object value)throws Exception {if(!(value instanceof String)||!((String)value).matches("[0-9a-f]{64}"))throw failure();}
    private static void uuid(String value)throws Exception {
        if(value==null||!value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))throw failure();
    }
    private static VaultFailure failure(){return new VaultFailure(FAILURE);}

    static final class Owned implements AutoCloseable {
        private final boolean frame;private final int index;private String metadata;private byte[] chunk;
        private Owned(boolean frame,int index,String metadata,byte[] chunk){this.frame=frame;this.index=index;this.metadata=metadata;this.chunk=chunk;}
        private void requireOpen()throws VaultFailure{if(chunk==null)throw failure();}
        synchronized JSONObject frameMetadata()throws VaultFailure {
            requireOpen();try{return new JSONObject(metadata);}catch(Exception invalid){throw failure();}
        }
        synchronized boolean isFrame()throws VaultFailure{requireOpen();return frame;}
        synchronized int chunkIndex()throws VaultFailure{requireOpen();return index;}
        synchronized byte[] copyChunk()throws VaultFailure{requireOpen();return chunk.clone();}
        @Override public synchronized void close(){if(chunk==null)return;Arrays.fill(chunk,(byte)0);chunk=null;metadata=null;}
        // Java String references are dropped, not claimed securely erased.
    }
}
