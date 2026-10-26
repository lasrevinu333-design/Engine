package org.memphiszoo.custodial.vault;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/** PRIVATE compiled-source representation only. NOT source authentication,
 * native inventory authority, a durable freeze, ACK, or permission capability.
 * The caller MUST retain its platform/document/control checks. JSONObject is
 * intentional for original JSON.stringify output; this is NOT a duplicate-key
 * HTTP parser guarantee and does not widen ProviderWireJson's parser bounds.
 */
final class NativeOriginalBrowserPreparationWire {
    static final String FAILURE="custodial_original_browser_preparation_unavailable";
    static final int MAX_JSON_BYTES=16*1024*1024, MAX_ARGUMENT_BYTES=4*1024*1024, MAX_ARGUMENT_TOTAL=8*1024*1024;
    private static final String[] BINDING={"operation_id","frame_sha256","original_generation_id","native_mutation_stamp"};
    private static final String[] REPLY={"schema","command","reply_token","request_nonce","phase_nonce",
        "operation_id","frame_sha256","original_generation_id","native_mutation_stamp","state",
        "observation","census","arguments_base64","reason"};
    private static final String[] OBSERVATION={"schema","browser_inventory_state","native_authority","frozen","acknowledged",
        "phone_released","state","observation_sha256","local_record_count","session_record_count","session_storage_state",
        "database_count","record_count","records"};
    private static final String[] CENSUS={"schema","browser_inventory_state","native_semantic_inventory_state",
        "native_authority","source_authenticated","frozen","complete_namespace_inventory","current_server_readback",
        "cutoff_eligible","acknowledged","work_accepted","key_removal","phone_released","state","observation_sha256",
        "record_count","local_record_count","session_record_count","session_storage_state","database_count",
        "primary_queue_row_count","argument_candidate_count","ambiguous_argument_candidate_count",
        "unresolved_record_count","domains","records"};

    /** Bounded, untrusted same-capture hold/epoch DATA only. No persisted
     * lock, source channel, current owner or native effect is authenticated. */
    static OwnedHoldFenceReply decodeHoldFence(String raw,String expectedReplyToken,String expectedRequestNonce,
        String expectedPhaseNonce,JSONObject expectedBinding,String expectedObservationSha256)throws VaultFailure {
        byte[] encoded=null;boolean transferred=false;
        try{
            token(expectedReplyToken);token(expectedRequestNonce);token(expectedPhaseNonce);hash(expectedObservationSha256);
            utf8Size(raw,32768);
            // A callback-bearing JSONObject subclass is not a fixed DATA tuple.
            if(expectedBinding==null||expectedBinding.getClass()!=JSONObject.class)throw failure();
            NativeRetainedAttempt.keys(expectedBinding,BINDING);
            String[] tuple=new String[BINDING.length];
            for(int i=0;i<BINDING.length;i++)tuple[i]=string(expectedBinding,BINDING[i]);
            uuid(tuple[0]);hash(tuple[1]);uuid(tuple[2]);
            if(tuple[3].isEmpty()||tuple[3].length()>4096)throw failure();
            utf8Size(tuple[3],32768);
            encoded=raw.getBytes(StandardCharsets.UTF_8);
            JSONObject reply=ProviderWireJson.object(encoded,32768);
            NativeRetainedAttempt.keys(reply,"schema","command","reply_token","request_nonce","phase_nonce",
                "operation_id","frame_sha256","original_generation_id","native_mutation_stamp","state",
                "hold_marker_sha256","mutation_epoch","observation_sha256","native_authority","inventory_acknowledged",
                "work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released");
            exact(reply,"schema","custodial.native-original-browser-hold-fence-response.v1");
            exact(reply,"command","HOLD_FENCE");exact(reply,"reply_token",expectedReplyToken);
            exact(reply,"request_nonce",expectedRequestNonce);exact(reply,"phase_nonce",expectedPhaseNonce);
            for(int i=0;i<BINDING.length;i++)exact(reply,BINDING[i],tuple[i]);
            exact(reply,"state","SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK");
            exact(reply,"observation_sha256",expectedObservationSha256);
            String epoch=string(reply,"mutation_epoch");
            if(!epoch.matches("[1-9][0-9]{0,18}")||Long.parseLong(epoch)<1)throw failure();
            // The operation UUID was validated above. This is the exact
            // existing marker JSON byte order, not JSONObject serialization.
            String marker="{\"schema\":\"custodial.browser-preservation-hold.v1\",\"operation_id\":\""+tuple[0]
                +"\",\"native_authority\":false}";
            exact(reply,"hold_marker_sha256",NativeRetainedAttempt.hash(marker.getBytes(StandardCharsets.UTF_8)));
            for(String key:new String[]{"native_authority","inventory_acknowledged","work_accepted","replay_allowed",
                "finalizer_allowed","key_removal","phone_released"})denied(reply,key);
            NativeRetainedAttempt.keys(expectedBinding,BINDING);
            for(int i=0;i<BINDING.length;i++)if(!tuple[i].equals(string(expectedBinding,BINDING[i])))throw failure();
            OwnedHoldFenceReply result=new OwnedHoldFenceReply(encoded);transferred=true;return result;
        }catch(Exception invalid){throw failure();}
        finally{if(!transferred&&encoded!=null)Arrays.fill(encoded,(byte)0);}
    }
    static final class OwnedHoldFenceReply implements AutoCloseable {
        private byte[] encoded;
        private OwnedHoldFenceReply(byte[] encoded){this.encoded=encoded;}
        synchronized JSONObject json()throws VaultFailure {
            if(encoded==null)throw failure();
            try{return ProviderWireJson.object(encoded,32768);}catch(Exception invalid){throw failure();}
        }
        @Override public synchronized void close(){
            if(encoded!=null)Arrays.fill(encoded,(byte)0);encoded=null;
        }
    }

    static OwnedReply decode(String raw,String command,String expectedReplyToken,String requestNonce,
        String phaseNonce,JSONObject originalBinding)throws VaultFailure {
        List<byte[]> arguments=new ArrayList<>();boolean transferred=false;
        try {
            final boolean capture="CAPTURE".equals(command)||"CAPTURE_EXISTING_HELD".equals(command);
            if(!capture&&!"RECHECK".equals(command))throw failure();
            token(expectedReplyToken);token(requestNonce);token(phaseNonce);
            utf8Size(raw,MAX_JSON_BYTES);
            if(originalBinding==null)throw failure();
            final JSONObject binding=new JSONObject(originalBinding.toString());
            JSONObject reply=new JSONObject(raw);
            NativeRetainedAttempt.keys(reply,REPLY);
            exact(reply,"schema","custodial.native-original-browser-capture-response.v1");
            exact(reply,"command",command);exact(reply,"reply_token",expectedReplyToken);
            exact(reply,"request_nonce",requestNonce);exact(reply,"phase_nonce",phaseNonce);
            NativeRetainedAttempt.keys(binding,BINDING);
            for(String key:BINDING)exact(reply,key,string(binding,key));
            uuid(string(binding,"operation_id"));uuid(string(binding,"original_generation_id"));
            hash(string(binding,"frame_sha256"));
            String stamp=string(binding,"native_mutation_stamp");
            if(stamp.isEmpty()||stamp.length()>4096)throw failure();
            exact(reply,"reason","");
            exact(reply,"state",capture?"CAPTURED_RETAINED_NOT_AUTHORITY":"RECHECKED_RETAINED_NOT_AUTHORITY");
            JSONObject observation=object(reply,"observation"),census=object(reply,"census");
            validateObservation(observation);validateCensus(census,observation);
            JSONArray encoded=array(reply,"arguments_base64");
            int count=integer(census,"argument_candidate_count",4096);
            if(encoded.length()!=(capture?count:0))throw failure();
            long total=0;
            for(int i=0;i<encoded.length();i++){
                Object item=encoded.get(i);if(!(item instanceof String))throw failure();String value=(String)item;
                if(value.length()>4*((MAX_ARGUMENT_BYTES+2)/3))throw failure();
                byte[] bytes=Base64.getDecoder().decode(value);
                // Transfer to owned cleanup BEFORE every remaining validation.
                arguments.add(bytes);total+=bytes.length;
                if(bytes.length==0||bytes.length>MAX_ARGUMENT_BYTES||total>MAX_ARGUMENT_TOTAL
                    ||!Base64.getEncoder().encodeToString(bytes).equals(value))throw failure();
            }
            List<OriginalArgumentRecord> argumentRecords=validateArgumentMetadata(census,observation,arguments,capture);
            OwnedReply result=new OwnedReply(command,expectedReplyToken,requestNonce,binding.toString(),
                observation.toString(),census.toString(),arguments,argumentRecords);
            transferred=true;return result;
        }catch(Exception invalid){throw failure();}
        finally{if(!transferred)wipe(arguments);}
    }

    private static void validateObservation(JSONObject value)throws Exception {
        NativeRetainedAttempt.keys(value,OBSERVATION);
        exact(value,"schema","custodial.browser-protected-observation.v1");
        exact(value,"state","OBSERVED_NOT_FROZEN");exact(value,"browser_inventory_state","UNKNOWN");
        for(String key:new String[]{"native_authority","frozen","acknowledged","phone_released"})denied(value,key);
        hash(string(value,"observation_sha256"));
        int local=integer(value,"local_record_count",4096),session=sessionCount(value),db=integer(value,"database_count",32);
        int count=integer(value,"record_count",4096);JSONArray rows=array(value,"records");
        if(count!=rows.length()||local+(session<0?0:session)>count)throw failure();
        int localRows=0,sessionRows=0,idbRows=0;java.util.Set<String> databases=new java.util.HashSet<>();
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);String store=string(row,"store");
            if("localStorage".equals(store)||"sessionStorage".equals(store)){
                NativeRetainedAttempt.keys(row,"store","key_sha256","body_sha256");
                if("localStorage".equals(store))localRows++;else sessionRows++;
            }else if("indexedDB".equals(store)){
                NativeRetainedAttempt.keys(row,"store","database","version","object_store","key_sha256","body_sha256");
                String database=string(row,"database");if(database.length()>1024)throw failure();
                positiveSafeInteger(row,"version");string(row,"object_store");databases.add(database);idbRows++;
            }else throw failure();
            hash(string(row,"key_sha256"));hash(string(row,"body_sha256"));
        }
        if(localRows!=local||sessionRows!=(session<0?0:session)||idbRows!=count-localRows-sessionRows||databases.size()>db)throw failure();
    }
    /** Complete original browser DATA, distinct from completion arguments.
     * This decoder still returns data only. The owning native channel must
     * independently keep its document, original principal and control fences.
     */
    static OwnedDataReply decodeData(String raw,String command,String expectedReplyToken,String requestNonce,
        String phaseNonce,JSONObject originalBinding,JSONObject originalObservation,int expectedChunkIndex)throws VaultFailure {
        byte[] chunk=null;boolean transferred=false;
        try{
            boolean frame="DATA_FRAME".equals(command);
            if(!frame&&!"DATA_CHUNK".equals(command)||frame&&expectedChunkIndex!=-1||!frame&&expectedChunkIndex<0)throw failure();
            token(expectedReplyToken);token(requestNonce);token(phaseNonce);utf8Size(raw,MAX_JSON_BYTES);
            JSONObject binding=new JSONObject(originalBinding.toString()),observation=new JSONObject(originalObservation.toString());
            NativeRetainedAttempt.keys(binding,BINDING);validateObservation(observation);
            JSONObject reply=new JSONObject(raw);
            NativeRetainedAttempt.keys(reply,"schema","command","reply_token","request_nonce","phase_nonce","operation_id",
                "frame_sha256","original_generation_id","native_mutation_stamp","state","data_frame","chunk_index","chunk_base64","reason");
            exact(reply,"schema","custodial.native-original-browser-data-response.v1");exact(reply,"command",command);
            exact(reply,"reply_token",expectedReplyToken);exact(reply,"request_nonce",requestNonce);exact(reply,"phase_nonce",phaseNonce);
            for(String key:BINDING)exact(reply,key,string(binding,key));
            uuid(string(binding,"operation_id"));uuid(string(binding,"original_generation_id"));hash(string(binding,"frame_sha256"));
            String stamp=string(binding,"native_mutation_stamp");if(stamp.isEmpty()||stamp.length()>4096)throw failure();
            exact(reply,"reason","");exact(reply,"state",frame?"VALUE_FRAME_RETAINED_NOT_AUTHORITY":"VALUE_CHUNK_RETAINED_NOT_AUTHORITY");
            JSONObject metadata=object(reply,"data_frame");
            NativeRetainedAttempt.keys(metadata,"schema","encoding","observation_sha256","frame_sha256","byte_count","chunk_bytes",
                "chunk_count","record_count","session_storage_state","chunk_sha256","native_authority","durable_retention",
                "inventory_acknowledged","finalizer_allowed","key_removal");
            exact(metadata,"schema","custodial.browser-original-value-frame.v1");exact(metadata,"encoding","MZBRV001");
            exact(metadata,"observation_sha256",string(observation,"observation_sha256"));hash(string(metadata,"frame_sha256"));
            exact(metadata,"session_storage_state",string(observation,"session_storage_state"));
            for(String key:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"})denied(metadata,key);
            int size=integer(metadata,"byte_count",64*1024*1024),chunkBytes=integer(metadata,"chunk_bytes",1048576),count=integer(metadata,"chunk_count",64);
            if(size<1||chunkBytes!=1048576||count!=1+(size-1)/chunkBytes
                ||integer(metadata,"record_count",4096)!=integer(observation,"record_count",4096))throw failure();
            JSONArray digests=array(metadata,"chunk_sha256");if(digests.length()!=count)throw failure();
            for(int i=0;i<count;i++){Object digest=digests.get(i);if(!(digest instanceof String))throw failure();hash((String)digest);}
            String encoded=string(reply,"chunk_base64");
            if(frame){if(reply.get("chunk_index")!=JSONObject.NULL||!encoded.isEmpty())throw failure();}
            else{
                if(expectedChunkIndex>=count||integer(reply,"chunk_index",63)!=expectedChunkIndex
                    ||encoded.length()>4*((chunkBytes+2)/3))throw failure();
                chunk=Base64.getDecoder().decode(encoded);
                if(chunk.length!=Math.min(chunkBytes,size-expectedChunkIndex*chunkBytes)
                    ||!Base64.getEncoder().encodeToString(chunk).equals(encoded)
                    ||!NativeRetainedAttempt.hash(chunk).equals(digests.getString(expectedChunkIndex)))throw failure();
            }
            var result=new OwnedDataReply(metadata.toString(),chunk);transferred=true;return result;
        }catch(Exception invalid){throw failure();}
        finally{if(!transferred&&chunk!=null)Arrays.fill(chunk,(byte)0);}
    }
    static final class OwnedDataReply implements AutoCloseable {
        private String metadata;private byte[] chunk;
        private OwnedDataReply(String metadata,byte[] chunk){this.metadata=metadata;this.chunk=chunk;}
        synchronized JSONObject metadata()throws VaultFailure {
            if(metadata==null)throw failure();try{return new JSONObject(metadata);}catch(Exception invalid){throw failure();}
        }
        synchronized byte[] copyChunk()throws VaultFailure {if(metadata==null||chunk==null)throw failure();return chunk.clone();}
        @Override public synchronized void close(){if(chunk!=null)Arrays.fill(chunk,(byte)0);chunk=null;metadata=null;}
    }
    private static void validateCensus(JSONObject value,JSONObject observation)throws Exception {
        NativeRetainedAttempt.keys(value,CENSUS);
        exact(value,"schema","custodial.browser-whole-capture-completion-census.v1");
        exact(value,"state","WHOLE_CAPTURE_COMPLETION_CENSUS_NOT_AUTHENTICATED");
        exact(value,"browser_inventory_state","UNKNOWN");exact(value,"native_semantic_inventory_state","UNKNOWN");
        for(String key:new String[]{"native_authority","source_authenticated","frozen","complete_namespace_inventory",
            "current_server_readback","cutoff_eligible","acknowledged","work_accepted","key_removal","phone_released"})denied(value,key);
        for(String key:new String[]{"observation_sha256","local_record_count","session_record_count","session_storage_state","database_count"})
            if(!ProviderWireJson.same(value.get(key),observation.get(key)))throw failure();
        sessionCount(value);integer(value,"database_count",32);
        int count=integer(value,"record_count",4096),primary=integer(value,"primary_queue_row_count",4096),
            arguments=integer(value,"argument_candidate_count",4096),ambiguous=integer(value,"ambiguous_argument_candidate_count",4096);
        int captured=integer(observation,"record_count",4096);
        if(count<captured||count!=array(value,"records").length()||integer(value,"unresolved_record_count",4096)!=count
            ||arguments>primary||primary>count||ambiguous>arguments)throw failure();
        // Census may include additional retained EMPTY-domain entries. Its row
        // count is deliberately NOT equated to the capture's count.
        JSONArray rows=array(value,"records");boolean[] retained=new boolean[captured];int originals=0;
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);
            denied(row,"source_authenticated");denied(row,"automatic_acceptance");
            if(row.has("capture_record_ordinal")){
                int ordinal=integer(row,"capture_record_ordinal",4095);
                if(ordinal>=captured||retained[ordinal])throw failure();retained[ordinal]=true;originals++;
                JSONObject original=observation.getJSONArray("records").getJSONObject(ordinal);
                for(var keys=original.keys();keys.hasNext();){String key=keys.next();
                    if(!row.has(key)||!ProviderWireJson.same(original.get(key),row.get(key)))throw failure();
                }
            }
        }
        if(originals!=captured)throw failure();
        JSONArray domains=array(value,"domains");if(domains.length()>2+32*129)throw failure();
        for(int i=0;i<domains.length();i++)if(!(domains.get(i) instanceof JSONObject))throw failure();
    }
    private static List<OriginalArgumentRecord> validateArgumentMetadata(JSONObject census,JSONObject observation,List<byte[]> arguments,boolean capture)throws Exception {
        int count=integer(census,"argument_candidate_count",4096);boolean[] seen=new boolean[count];
        OriginalArgumentRecord[] records=new OriginalArgumentRecord[count];
        int found=0,ambiguous=0;JSONArray rows=array(census,"records");
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);boolean ordinal=row.has("candidate_ordinal"),digest=row.has("argument_values_sha256");
            if(ordinal!=digest)throw failure();if(!ordinal)continue;
            int position=integer(row,"candidate_ordinal",4095);
            if(position>=count||seen[position])throw failure();seen[position]=true;found++;
            // EMPTY-domain diagnostics may be retained in the census but can
            // never supply argument bytes. validateCensus already bound each
            // captured ordinal and its exact domain/key/body fields once.
            int captured=integer(row,"capture_record_ordinal",4095);
            JSONArray originals=array(observation,"records");if(captured>=originals.length())throw failure();
            JSONObject original=originals.getJSONObject(captured);
            // Mirror the existing producer's candidate realm only. Unsupported
            // ordinary captured rows without a candidate remain retained.
            exact(original,"store","indexedDB");exact(original,"database","mz_scan_queue");
            if(integer(original,"version",6)<1)throw failure();
            exact(original,"object_store","actions");
            exact(row,"kind","PRIMARY_QUEUE_ORIGINAL");String state=string(row,"state");
            if(!"STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED".equals(state)){
                if(!"AMBIGUOUS_COMPLETION_ARGUMENT_ROWS_RETAINED".equals(state)
                    &&!"AMBIGUOUS_SESSION_ARGUMENT_ROWS_RETAINED".equals(state)
                    &&!"AMBIGUOUS_QUEUE_OPERATION_ROWS_RETAINED".equals(state))throw failure();
                ambiguous++;
            }
            String expected=string(row,"argument_values_sha256");hash(expected);
            if(capture&&!expected.equals(NativeRetainedAttempt.hash(arguments.get(position))))throw failure();
            String store=string(original,"store");boolean indexed="indexedDB".equals(store);
            records[position]=new OriginalArgumentRecord(position,captured,store,
                indexed?string(original,"database"):null,indexed?Long.valueOf(((Number)original.get("version")).longValue()):null,
                indexed?string(original,"object_store"):null,string(original,"key_sha256"),string(original,"body_sha256"),expected,state);
        }
        if(found!=count||ambiguous!=integer(census,"ambiguous_argument_candidate_count",4096))throw failure();
        return List.copyOf(Arrays.asList(records));
    }
    private static int sessionCount(JSONObject value)throws Exception {
        Object count=value.get("session_record_count");String state=string(value,"session_storage_state");
        if(count==JSONObject.NULL){if(!"NOT_DECLARED_UNKNOWN".equals(state))throw failure();return -1;}
        if(!"CAPTURED_READ_ONLY_NOT_AUTHENTICATED".equals(state))throw failure();return integer(value,"session_record_count",4096);
    }
    private static int integer(JSONObject value,String key,int maximum)throws Exception {
        Object number=value.get(key);if(!(number instanceof Integer)&&!(number instanceof Long))throw failure();
        long n=((Number)number).longValue();if(n<0||n>maximum)throw failure();return (int)n;
    }
    private static void positiveSafeInteger(JSONObject value,String key)throws Exception {
        Object number=value.get(key);if(!(number instanceof Integer)&&!(number instanceof Long))throw failure();
        long n=((Number)number).longValue();if(n<1||n>9007199254740991L)throw failure();
    }
    private static String string(JSONObject value,String key)throws Exception {
        Object text=value.get(key);if(!(text instanceof String))throw failure();return (String)text;
    }
    private static JSONObject object(JSONObject value,String key)throws Exception {
        Object result=value.get(key);if(!(result instanceof JSONObject))throw failure();return (JSONObject)result;
    }
    private static JSONArray array(JSONObject value,String key)throws Exception {
        Object result=value.get(key);if(!(result instanceof JSONArray))throw failure();return (JSONArray)result;
    }
    private static void exact(JSONObject value,String key,String expected)throws Exception {
        if(expected==null||!expected.equals(string(value,key)))throw failure();
    }
    private static void denied(JSONObject value,String key)throws Exception {if(value.get(key)!=Boolean.FALSE)throw failure();}
    private static void token(String value)throws VaultFailure {if(value==null||!value.matches("[0-9a-f]{64}"))throw failure();}
    private static void hash(String value)throws VaultFailure {if(value==null||!value.matches("[0-9a-f]{64}"))throw failure();}
    private static void uuid(String value)throws VaultFailure {if(value==null||!value.matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}"))throw failure();}
    private static void utf8Size(String value,int maximum)throws VaultFailure {
        if(value==null||value.isEmpty()||value.length()>maximum||value.charAt(0)=='\ufeff')throw failure();
        long count=0;
        for(int i=0;i<value.length();i++){
            char c=value.charAt(i);
            if(Character.isHighSurrogate(c)){if(++i>=value.length()||!Character.isLowSurrogate(value.charAt(i)))throw failure();count+=4;}
            else if(Character.isLowSurrogate(c))throw failure();
            else count+=c<0x80?1:c<0x800?2:3;
            if(count>maximum)throw failure();
        }
    }
    private static void wipe(List<byte[]> values){for(byte[] value:values)Arrays.fill(value,(byte)0);}
    private static VaultFailure failure(){return new VaultFailure(FAILURE);}

    /** Immutable data correlation to a declared captured row, NOT Source auth,
     * binary-row payload decoding, semantic acceptance or any effect right.
     * CAPTURE hashes the owned argument bytes; RECHECK owns no argument bytes
     * and still requires the caller's existing original metadata comparison. */
    static final class OriginalArgumentRecord {
        final int candidateOrdinal,captureRecordOrdinal;
        final String store,database,objectStore,keySha256,bodySha256,argumentSha256,candidateState;
        final Long version;
        private OriginalArgumentRecord(int candidateOrdinal,int captureRecordOrdinal,String store,String database,Long version,
            String objectStore,String keySha256,String bodySha256,String argumentSha256,String candidateState){
            this.candidateOrdinal=candidateOrdinal;this.captureRecordOrdinal=captureRecordOrdinal;this.store=store;this.database=database;
            this.version=version;this.objectStore=objectStore;this.keySha256=keySha256;this.bodySha256=bodySha256;
            this.argumentSha256=argumentSha256;this.candidateState=candidateState;
        }
    }

    static final class OwnedReply implements AutoCloseable {
        private String command,replyToken,requestNonce,binding,observation,census;
        private List<byte[]> arguments;
        private List<OriginalArgumentRecord> argumentRecords;
        private OwnedReply(String command,String token,String nonce,String binding,String observation,String census,List<byte[]> arguments,List<OriginalArgumentRecord> argumentRecords){
            this.command=command;replyToken=token;requestNonce=nonce;this.binding=binding;this.observation=observation;this.census=census;
            this.arguments=new ArrayList<>(arguments);
            this.argumentRecords=List.copyOf(argumentRecords);
        }
        private void requireOpen()throws VaultFailure {if(arguments==null)throw failure();}
        synchronized JSONObject observation()throws VaultFailure {requireOpen();try{return new JSONObject(observation);}catch(Exception invalid){throw failure();}}
        synchronized JSONObject census()throws VaultFailure {requireOpen();try{return new JSONObject(census);}catch(Exception invalid){throw failure();}}
        synchronized List<OriginalArgumentRecord> originalArgumentRecords()throws VaultFailure {requireOpen();return argumentRecords;}
        synchronized List<byte[]> copyArguments()throws VaultFailure {
            requireOpen();List<byte[]> copy=new ArrayList<>();
            try{for(byte[] bytes:arguments)copy.add(bytes.clone());return copy;}
            catch(RuntimeException|Error invalid){wipe(copy);throw invalid;}
        }
        void requireSameMetadata(OwnedReply recheck)throws VaultFailure {
            final String[] original=metadata();if(recheck==null||recheck==this)throw failure();
            // Snapshot the other owned graph without exporting any capability.
            final String[] other=recheck.metadata();
            try{
                if(!("CAPTURE".equals(original[0])||"CAPTURE_EXISTING_HELD".equals(original[0]))
                    ||!"RECHECK".equals(other[0])||!original[1].equals(other[1])||!original[2].equals(other[2])
                    ||!ProviderWireJson.same(new JSONObject(original[3]),new JSONObject(other[3]))
                    ||!ProviderWireJson.same(new JSONObject(original[4]),new JSONObject(other[4]))
                    ||!ProviderWireJson.same(new JSONObject(original[5]),new JSONObject(other[5])))throw failure();
            }catch(Exception invalid){throw failure();}
            metadata();recheck.metadata(); // No nested object monitors or closed-object readback.
        }
        private synchronized String[] metadata()throws VaultFailure {requireOpen();return new String[]{command,replyToken,requestNonce,binding,observation,census};}
        @Override public synchronized void close(){
            if(arguments==null)return;wipe(arguments);arguments=null;
            argumentRecords=null;
            command=replyToken=requestNonce=binding=observation=census=null;
            // Dropping Java String references is NOT a secure-erasure claim.
        }
    }
}
