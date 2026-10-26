package org.memphiszoo.custodial.vault;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Fixed lossless MZBRV001 DATA reader, not a source/authentication capability.
 * No original values are returned or repaired. Main's owning channel must still
 * prove platform source, control and owner currentness before/after this read. */
final class NativeOriginalBrowserValueFrame {
    private static final String OBS="custodial.browser-protected-observation.v1";
    private static final int CHUNK=1048576, MAX=64*CHUNK;
    private NativeOriginalBrowserValueFrame() {}

    /** Parse identity only: neither semantic acceptance nor source, owner,
     * durable custody, manager, ACK, finalizer or key-removal authority. */
    static final class Record {
        final int ordinal;
        final String store,database,objectStore,keySha256,bodySha256,semanticDisposition;
        final Long version;
        private Record(int ordinal,String store,String database,Long version,String objectStore,String keySha256,String bodySha256) {
            this.ordinal=ordinal;this.store=store;this.database=database;this.version=version;this.objectStore=objectStore;
            this.keySha256=keySha256;this.bodySha256=bodySha256;this.semanticDisposition="UNRESOLVED_RETAINED";
        }
    }

    /** Exact binary-declared realm DATA, including EMPTY and unavailable
     * session storage. Rows alone cannot enumerate an empty database/store.
     * This never supplies browser source, acceptance or removal authority. */
    static final class Domain {
        final String store,database,objectStore,state;
        final Long version;
        final int recordCount;
        private Domain(String store,String database,Long version,String objectStore,int count,String state){
            this.store=store;this.database=database;this.version=version;this.objectStore=objectStore;
            recordCount=count;this.state=state;
        }
    }
    static final class OriginalRecords {
        final String observationSha256,frameSha256,sessionStorageState;
        final int recordCount;
        private final List<Record> entries;
        private final List<Domain> domains;
        private final List<ArgumentPayloadMatch> argumentMatches;
        private final List<NativeArgumentPayloadMatch> nativeMatches;
        private final OriginalHeldBrowserMetadata heldBrowserMetadata;
        private OriginalRecords(String observationSha256,String frameSha256,String sessionStorageState,List<Record> entries,
            List<ArgumentPayloadMatch> argumentMatches,List<NativeArgumentPayloadMatch> nativeMatches,List<Domain> domains,
            OriginalHeldBrowserMetadata heldBrowserMetadata) {
            this.observationSha256=observationSha256;this.frameSha256=frameSha256;this.sessionStorageState=sessionStorageState;
            this.entries=List.copyOf(entries);this.recordCount=this.entries.size();
            this.argumentMatches=List.copyOf(argumentMatches);
            this.nativeMatches=List.copyOf(nativeMatches);
            this.domains=List.copyOf(domains);
            this.heldBrowserMetadata=heldBrowserMetadata;
        }
        List<Record> originalRecords(){return entries;}
        List<Domain> declaredDomains(){return domains;}
        List<ArgumentPayloadMatch> argumentPayloadMatches(){return argumentMatches;}
        List<NativeArgumentPayloadMatch> nativeArgumentPayloadMatches(){return nativeMatches;}
        OriginalHeldBrowserMetadata originalHeldBrowserMetadata(){return heldBrowserMetadata;}
    }

    /** Original localStorage DATA only, not a current hold, source, operation
     * binding, writer admission or ACK. No raw marker/epoch row is exposed. */
    static final class OriginalHeldBrowserMetadata {
        final String operationId,holdMarkerSha256,mutationEpoch;
        private OriginalHeldBrowserMetadata(String operationId,String holdMarkerSha256,String mutationEpoch){
            this.operationId=operationId;this.holdMarkerSha256=holdMarkerSha256;this.mutationEpoch=mutationEpoch;
        }
    }

    /** Actual parsed row DATA comparison only, never a source/acceptance or
     * removal capability. Unsupported and ambiguous originals stay retained. */
    static final class ArgumentPayloadMatch {
        final int candidateOrdinal,captureRecordOrdinal;
        final String argumentSha256;
        final boolean matchesOriginalPayload;
        private ArgumentPayloadMatch(int candidate,int captured,String argumentSha256,boolean matched){
            candidateOrdinal=candidate;captureRecordOrdinal=captured;this.argumentSha256=argumentSha256;
            matchesOriginalPayload=matched;
        }
    }

    /** One actual frame row versus the complete native argument DATA loan.
     * No browser-provided candidate subset or ambiguity label selects it.
     * Even a match has no source/authentication/SQL/ACK authority. */
    static final class NativeArgumentPayloadMatch {
        final int captureRecordOrdinal,nativeArgumentOrdinal;
        final String argumentSha256;
        final boolean matchesOriginalPayload;
        private NativeArgumentPayloadMatch(int captured,int argument,String digest,boolean matched){
            captureRecordOrdinal=captured;nativeArgumentOrdinal=argument;argumentSha256=digest;matchesOriginalPayload=matched;
        }
    }

    static void requireCompleteOriginalValues(JSONObject frameMetadata,JSONObject originalObservation,
                                               List<byte[]> originalOwnedChunks)throws VaultFailure {
        inspectCompleteOriginalValues(frameMetadata,originalObservation,originalOwnedChunks);
    }

    static OriginalRecords inspectCompleteOriginalValues(JSONObject frameMetadata,JSONObject originalObservation,
                                                         List<byte[]> originalOwnedChunks)throws VaultFailure {
        return inspectCompleteOriginalValues(frameMetadata,originalObservation,originalOwnedChunks,List.of(),List.of());
    }

    static OriginalRecords inspectCompleteOriginalValues(JSONObject frameMetadata,JSONObject originalObservation,
        List<byte[]> originalOwnedChunks,List<NativeOriginalBrowserPreparationWire.OriginalArgumentRecord> declared,
        List<byte[]> exactArguments)throws VaultFailure {
        return inspectCompleteOriginalValuesInternal(frameMetadata,originalObservation,originalOwnedChunks,declared,exactArguments,null,false);
    }
    static OriginalRecords inspectCompleteOriginalValues(JSONObject frameMetadata,JSONObject originalObservation,
        List<byte[]> originalOwnedChunks,List<NativeOriginalBrowserPreparationWire.OriginalArgumentRecord> declared,
        List<byte[]> exactArguments,List<byte[]> completeOriginalNativeArguments)throws VaultFailure {
        if(completeOriginalNativeArguments==null)throw fail();
        return inspectCompleteOriginalValuesInternal(frameMetadata,originalObservation,originalOwnedChunks,declared,exactArguments,
            completeOriginalNativeArguments,false);
    }
    /** DATA-only restart read of already-authenticated original journal bytes.
     * No diagnostic observation is fabricated or supplied as row authority.
     * The owning caller must still prove journal AEAD/plan/source currentness. */
    static OriginalRecords inspectRetainedOriginalValues(JSONObject fixedJournalFrameMetadata,List<byte[]> originalOwnedChunks,
        List<byte[]> completeOriginalNativeArguments)throws VaultFailure {
        if(completeOriginalNativeArguments==null)throw fail();
        return inspectCompleteOriginalValuesInternal(fixedJournalFrameMetadata,null,originalOwnedChunks,List.of(),List.of(),
            completeOriginalNativeArguments,true);
    }
    private static OriginalRecords inspectCompleteOriginalValuesInternal(JSONObject frameMetadata,JSONObject originalObservation,
        List<byte[]> originalOwnedChunks,List<NativeOriginalBrowserPreparationWire.OriginalArgumentRecord> declared,
        List<byte[]> exactArguments,List<byte[]> nativeArguments,boolean retained)throws VaultFailure {
        List<byte[]> copies=new ArrayList<>(),borrowed=new ArrayList<>();
        List<byte[]> argumentCopies=new ArrayList<>(),argumentLoans=new ArrayList<>();
        List<byte[]> nativeCopies=new ArrayList<>(),nativeLoans=new ArrayList<>();
        Reader reader=null;
        try {
            if(frameMetadata==null||!retained&&originalObservation==null||retained&&originalObservation!=null
                ||originalOwnedChunks==null||declared==null||exactArguments==null
                ||declared.size()!=exactArguments.size()||declared.size()>4096)throw fail();
            if(retained&&(!declared.isEmpty()||!exactArguments.isEmpty()||nativeArguments==null))throw fail();
            var candidates=List.copyOf(declared);long argumentBytes=0;
            for(int i=0;i<candidates.size();i++){
                byte[] source=exactArguments.get(i);var candidate=candidates.get(i);
                if(candidate.candidateOrdinal!=i||source==null||source.length<1||source.length>4*CHUNK
                    ||(argumentBytes+=source.length)>8*CHUNK)throw fail();
                byte[] copy=source.clone();argumentCopies.add(copy);argumentLoans.add(source);
                if(!hexDigest(copy).equals(candidate.argumentSha256))throw fail();
            }
            if(nativeArguments!=null){
                if(nativeArguments.size()>4096)throw fail();long bytes=0;
                for(byte[] original:nativeArguments){
                    if(original==null||original.length<1||original.length>4*CHUNK||(bytes+=original.length)>8*CHUNK)throw fail();
                    nativeLoans.add(original);nativeCopies.add(original.clone());
                }
            }
            // Detached metadata only, never a reconstruction of the original value tree.
            String metadataText=frameMetadata.toString(),observationText=retained?null:originalObservation.toString();
            if(metadataText.length()>16384||!retained&&observationText.length()>16*1048576)throw fail();
            JSONObject m=new JSONObject(metadataText),o=retained?null:new JSONObject(observationText);
            NativeRetainedAttempt.keys(m,"schema","encoding","observation_sha256","frame_sha256","byte_count","chunk_bytes",
                "chunk_count","record_count","session_storage_state","chunk_sha256","native_authority","durable_retention",
                "inventory_acknowledged","finalizer_allowed","key_removal");
            exact(m,"schema","custodial.browser-original-value-frame.v1");exact(m,"encoding","MZBRV001");
            for(String k:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"})denied(m,k);
            String observationHash=hash(m,"observation_sha256");
            if(!retained){
                validateObservation(o);observationHash=hash(o,"observation_sha256");
                exact(m,"observation_sha256",observationHash);exact(m,"session_storage_state",text(o,"session_storage_state"));
            }else if(!"NOT_DECLARED_UNKNOWN".equals(text(m,"session_storage_state"))
                &&!"CAPTURED_READ_ONLY_NOT_AUTHENTICATED".equals(text(m,"session_storage_state")))throw fail();
            int size=integer(m,"byte_count",MAX),count=integer(m,"chunk_count",64);
            if(size<56||integer(m,"chunk_bytes",CHUNK)!=CHUNK||count!=1+(size-1)/CHUNK
                ||!retained&&integer(m,"record_count",4096)!=integer(o,"record_count",4096)||originalOwnedChunks.size()!=count)throw fail();
            int expectedRecords=integer(m,"record_count",4096);
            JSONArray hashes=m.getJSONArray("chunk_sha256");if(hashes.length()!=count)throw fail();
            MessageDigest frame=MessageDigest.getInstance("SHA-256");
            for(int i=0;i<count;i++){
                byte[] source=originalOwnedChunks.get(i);
                if(source==null||source.length!=Math.min(CHUNK,size-i*CHUNK))throw fail();
                String expected=hashText(hashes.get(i));
                byte[] copy=source.clone();copies.add(copy);borrowed.add(source);
                if(!hexDigest(copy).equals(expected))throw fail();frame.update(copy);
            }
            String frameHash=hex(frame.digest());
            if(!frameHash.equals(hash(m,"frame_sha256")))throw fail();
            reader=new Reader(copies,size,o,candidates,argumentCopies,nativeArguments==null?null:nativeCopies,retained,expectedRecords);
            for(char c:"MZBRV001".toCharArray())if(reader.byteValue()!=c)throw fail();
            byte[] headerHash=new byte[32];
            try{for(int i=0;i<32;i++)headerHash[i]=(byte)reader.byteValue();
                if(!hex(headerHash).equals(observationHash))throw fail();
            }finally{Arrays.fill(headerHash,(byte)0);}
            int local=reader.signedInt(),session=reader.signedInt(),db=reader.signedInt(),records=reader.signedInt();
            if(retained){
                if(local<0||local>4096||session< -1||session>4096||db<0||db>32||records!=expectedRecords
                    ||local+Math.max(session,0)>records)throw fail();
                exact(m,"session_storage_state",session==-1?"NOT_DECLARED_UNKNOWN":"CAPTURED_READ_ONLY_NOT_AUTHENTICATED");
            }else if(local!=integer(o,"local_record_count",4096)||session!=session(o)
                ||db!=integer(o,"database_count",32)||records!=integer(o,"record_count",4096))throw fail();
            reader.original(local,session,db);
            if(reader.position!=size||reader.record!=records||!reader.whole.finish().equals(observationHash))throw fail();
            // Refuse changed loans or metadata; parsing only used private byte snapshots.
            if(originalOwnedChunks.size()!=count||!ProviderWireJson.same(m,frameMetadata)
                ||!retained&&!ProviderWireJson.same(o,originalObservation))throw fail();
            for(int i=0;i<count;i++)if(originalOwnedChunks.get(i)!=borrowed.get(i)
                ||!Arrays.equals(borrowed.get(i),copies.get(i)))throw fail();
            if(exactArguments.size()!=argumentLoans.size()||!candidates.equals(declared))throw fail();
            for(int i=0;i<argumentLoans.size();i++)if(exactArguments.get(i)!=argumentLoans.get(i)
                ||!Arrays.equals(argumentLoans.get(i),argumentCopies.get(i)))throw fail();
            if(nativeArguments!=null){
                if(nativeArguments.size()!=nativeLoans.size())throw fail();
                for(int i=0;i<nativeLoans.size();i++)if(nativeArguments.get(i)!=nativeLoans.get(i)
                    ||!Arrays.equals(nativeLoans.get(i),nativeCopies.get(i)))throw fail();
            }
            if(retained){
                // A supplied loan-list implementation may change earlier DATA
                // during a later get(). Finish all those calls before the final
                // detached-byte and metadata comparisons in restart mode.
                for(int i=0;i<borrowed.size();i++)if(!Arrays.equals(borrowed.get(i),copies.get(i)))throw fail();
                for(int i=0;i<nativeLoans.size();i++)if(!Arrays.equals(nativeLoans.get(i),nativeCopies.get(i)))throw fail();
            }
            // Metadata/observed-source checks must follow every borrowed-list
            // callback too, including the legacy observed-frame entry points.
            if(!ProviderWireJson.same(m,frameMetadata)
                ||!retained&&!ProviderWireJson.same(o,originalObservation))throw fail();
            // Publish only after the entire frame, ordered rows, transcript,
            // metadata and original borrowed arrays have passed every check.
            return new OriginalRecords(observationHash,frameHash,text(m,"session_storage_state"),reader.entries,reader.argumentMatches,
                reader.nativeMatchesAfterCompleteRows(),reader.domains,reader.heldMetadataAfterCompleteFrame());
        }catch(Exception invalid){throw fail();}
        finally{
            if(reader!=null)reader.close();
            for(byte[] bytes:copies)Arrays.fill(bytes,(byte)0);
            for(byte[] bytes:argumentCopies)Arrays.fill(bytes,(byte)0);
            for(byte[] bytes:nativeCopies)Arrays.fill(bytes,(byte)0);
        }
    }

    private static void validateObservation(JSONObject o)throws Exception {
        NativeRetainedAttempt.keys(o,"schema","browser_inventory_state","native_authority","frozen","acknowledged","phone_released",
            "state","observation_sha256","local_record_count","session_record_count","session_storage_state","database_count","record_count","records");
        exact(o,"schema",OBS);exact(o,"browser_inventory_state","UNKNOWN");exact(o,"state","OBSERVED_NOT_FROZEN");
        for(String k:new String[]{"native_authority","frozen","acknowledged","phone_released"})denied(o,k);
        hash(o,"observation_sha256");integer(o,"local_record_count",4096);session(o);integer(o,"database_count",32);
        if(o.getJSONArray("records").length()!=integer(o,"record_count",4096))throw fail();
    }
    private static int session(JSONObject o)throws Exception {
        if(o.get("session_record_count")==JSONObject.NULL){exact(o,"session_storage_state","NOT_DECLARED_UNKNOWN");return -1;}
        exact(o,"session_storage_state","CAPTURED_READ_ONLY_NOT_AUTHENTICATED");return integer(o,"session_record_count",4096);
    }
    private static int integer(JSONObject o,String key,int maximum)throws Exception {
        Object n=o.get(key);if(!(n instanceof Integer)&&!(n instanceof Long))throw fail();
        long v=((Number)n).longValue();if(v<0||v>maximum)throw fail();return (int)v;
    }
    private static String text(JSONObject o,String k)throws Exception {Object v=o.get(k);if(!(v instanceof String))throw fail();return (String)v;}
    private static String hash(JSONObject o,String k)throws Exception{return hashText(o.get(k));}
    private static String hashText(Object v)throws Exception {if(!(v instanceof String)||!((String)v).matches("[0-9a-f]{64}"))throw fail();return (String)v;}
    private static void exact(JSONObject o,String k,String v)throws Exception{if(!v.equals(text(o,k)))throw fail();}
    private static void denied(JSONObject o,String k)throws Exception{if(o.get(k)!=Boolean.FALSE)throw fail();}
    private static String hex(byte[] bytes){StringBuilder s=new StringBuilder(bytes.length*2);for(byte b:bytes)s.append("0123456789abcdef".charAt((b&255)>>>4)).append("0123456789abcdef".charAt(b&15));return s.toString();}
    private static String hexDigest(byte[] bytes)throws Exception{return hex(MessageDigest.getInstance("SHA-256").digest(bytes));}
    private static VaultFailure fail(){return new VaultFailure(NativeOriginalBrowserPreparationWire.FAILURE);}

    /** Buffers only digest input, not the full JSON/plaintext tree. */
    private static final class Sink {
        final MessageDigest digest;final byte[] buffer=new byte[8192];int used;
        Sink()throws Exception{digest=MessageDigest.getInstance("SHA-256");}
        void unit(char c){if(used==buffer.length)flush();buffer[used++]=(byte)(c>>>8);buffer[used++]=(byte)c;}
        void flush(){digest.update(buffer,0,used);Arrays.fill(buffer,0,used,(byte)0);used=0;}
        String finish(){flush();return hex(digest.digest());}
        void close(){Arrays.fill(buffer,(byte)0);digest.reset();used=0;}
    }
    /** Temporary selected-row JSON only. Overflow is retained-unresolved,
     * not a truncated match or a reason to discard any original frame row. */
    private static final class PartJson {
        private static final int MAX_UNITS=1048576;
        private char[] chars=new char[2048];private int used;private boolean overflow;
        void unit(char c){
            if(overflow)return;
            if(used==MAX_UNITS){overflow=true;close();return;}
            if(used==chars.length){char[] old=chars;chars=Arrays.copyOf(old,Math.min(MAX_UNITS,old.length*2));Arrays.fill(old,'\0');}
            chars[used++]=c;
        }
        byte[] finish()throws Exception {
            java.nio.ByteBuffer encoded=null;
            try{
                if(overflow)return null;
                encoded=java.nio.charset.StandardCharsets.UTF_8.newEncoder()
                    .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                    .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                    .encode(java.nio.CharBuffer.wrap(chars,0,used));
                byte[] result=new byte[encoded.remaining()];encoded.get(result);return result;
            }finally{if(encoded!=null&&encoded.hasArray())Arrays.fill(encoded.array(),(byte)0);close();}
        }
        void close(){Arrays.fill(chars,'\0');used=0;}
    }
    private static final class Reader {
        private static final String HOLD_KEY="mz_custodial_protected_browser_hold.v1";
        private static final String EPOCH_KEY="mz_custodial_protected_browser_mutation.v1";
        private String originalHoldMarker,originalMutationEpoch;
        final List<byte[]> chunks;final int size;final JSONObject observation;final Sink whole;
        final boolean retained;final int expectedRecords;
        final List<Record> entries=new ArrayList<>();
        final List<Domain> domains=new ArrayList<>();
        final List<NativeOriginalBrowserPreparationWire.OriginalArgumentRecord> candidates;
        final List<byte[]> arguments;final java.util.Map<Integer,Integer> candidateByRow=new java.util.HashMap<>();
        final List<ArgumentPayloadMatch> argumentMatches;
        final List<byte[]> nativeArguments;
        final java.util.Map<String,List<Integer>> nativeByCompletion=new java.util.HashMap<>();
        final java.util.Map<String,Integer> primaryIdentityCounts=new java.util.HashMap<>();
        final List<String[]> nativeRowIdentities=new ArrayList<>();
        final List<NativeArgumentPayloadMatch> tentativeNativeMatches=new ArrayList<>();
        boolean primaryRow;
        PartJson partJson;byte[] lastPartJson,keyJson,bodyJson;
        Sink part;int position,nodes,record;
        Reader(List<byte[]> chunks,int size,JSONObject observation,
            List<NativeOriginalBrowserPreparationWire.OriginalArgumentRecord> candidates,List<byte[]> arguments,
            List<byte[]> nativeArguments,boolean retained,int expectedRecords)throws Exception {
            this.chunks=chunks;this.size=size;this.observation=observation;whole=new Sink();
            this.retained=retained;this.expectedRecords=expectedRecords;
            if(retained&&(observation!=null||!candidates.isEmpty())||!retained&&observation==null)throw fail();
            this.candidates=candidates;this.arguments=arguments;
            this.nativeArguments=nativeArguments;
            argumentMatches=new ArrayList<>(java.util.Collections.nCopies(candidates.size(),null));
            for(int i=0;i<candidates.size();i++)if(candidates.get(i).captureRecordOrdinal<0
                ||candidates.get(i).captureRecordOrdinal>=(retained?expectedRecords:observation.getJSONArray("records").length())
                ||candidateByRow.put(candidates.get(i).captureRecordOrdinal,i)!=null)throw fail();
            if(nativeArguments!=null)for(int i=0;i<nativeArguments.size();i++){
                var value=ProviderWireJson.object(nativeArguments.get(i),4*CHUNK);
                String device=text(value,"p_device_id"),session=text(value,"p_client_session_id"),completion=text(value,"p_client_completion_id");
                if(!device.matches("[A-Z0-9_-]{1,64}")||!uuidText(session)||!uuidText(completion))throw fail();
                nativeByCompletion.computeIfAbsent(completionKey(device,session,completion),unused->new ArrayList<>()).add(i);
            }
        }
        private static boolean uuidText(String value){return value.matches("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}");}
        private static String completionKey(String device,String session,String completion){return device+'\0'+session+'\0'+completion;}
        private static NativeArgumentPayloadMatch unresolved(int row){return new NativeArgumentPayloadMatch(row,-1,"",false);}
        List<NativeArgumentPayloadMatch> nativeMatchesAfterCompleteRows()throws Exception {
            if(nativeArguments==null)return List.of();
            if(tentativeNativeMatches.size()!=record||nativeRowIdentities.size()!=record)throw fail();
            var result=new ArrayList<NativeArgumentPayloadMatch>();
            for(int i=0;i<record;i++){
                var match=tentativeNativeMatches.get(i);boolean unique=match.matchesOriginalPayload;
                var identities=nativeRowIdentities.get(i);
                if(unique){if(identities==null)throw fail();for(String identity:identities)
                    if(primaryIdentityCounts.getOrDefault(identity,0)!=1)unique=false;}
                result.add(unique?match:unresolved(i));
            }
            return List.copyOf(result);
        }
        int byteValue()throws Exception{if(position>=size)throw fail();int p=position++;return chunks.get(p/CHUNK)[p%CHUNK]&255;}
        int signedInt()throws Exception{return (byteValue()<<24)|(byteValue()<<16)|(byteValue()<<8)|byteValue();}
        int length(int maximum)throws Exception{long n=Integer.toUnsignedLong(signedInt());if(n>maximum)throw fail();return (int)n;}
        // Raw Source depth64 expands each object into three tagged-array layers,
        // plus the fixed root/database/store/row wrappers. No raw-depth rule changes.
        void node(int depth)throws Exception{if(depth>256||++nodes>1000000)throw fail();}
        int array(int maximum,int depth)throws Exception{node(depth);if(byteValue()!=5)throw fail();return length(maximum);}
        void arrayExact(int n,int depth)throws Exception{if(array(n,depth)!=n)throw fail();}
        void emit(char c){whole.unit(c);if(part!=null)part.unit(c);if(partJson!=null)partJson.unit(c);}
        void emit(String s){for(int i=0;i<s.length();i++)emit(s.charAt(i));}
        void escape(char c){emit("\\u");for(int shift=12;shift>=0;shift-=4)emit("0123456789abcdef".charAt((c>>>shift)&15));}
        void quoted(char c){
            switch(c){case '"':emit("\\\"");break;case '\\':emit("\\\\");break;
                case '\b':emit("\\b");break;case '\f':emit("\\f");break;case '\n':emit("\\n");break;
                case '\r':emit("\\r");break;case '\t':emit("\\t");break;
                default:if(c<32||Character.isSurrogate(c))escape(c);else emit(c);}
        }
        int unit()throws Exception{return (byteValue()<<8)|byteValue();}
        String string(int maximum,boolean retain,int depth)throws Exception {
            return string(maximum,retain,depth,maximum);
        }
        String string(int maximum,boolean retain,int depth,int retentionMaximum)throws Exception {
            node(depth);if(byteValue()!=4)throw fail();int n=length(maximum);
            if((long)n*2>size-position)throw fail();
            // The 64MiB binary bound includes generated opaque tag strings.
            // Do not count these as original Source budgetString characters.
            // A selected metadata body over its small retention limit remains
            // a fully streamed original row, not a malformed/truncated frame.
            StringBuilder saved=retain&&n<=retentionMaximum?new StringBuilder(n):null;emit('"');
            int pending=-1;
            for(int i=0;i<n;i++){
                char c=(char)(pending>=0?pending:unit());pending=-1;
                if(saved!=null)saved.append(c);
                if(Character.isHighSurrogate(c)&&i+1<n){
                    char next=(char)unit();
                    if(Character.isLowSurrogate(next)){emit(c);emit(next);if(saved!=null)saved.append(next);i++;}
                    else{escape(c);pending=next;}
                }else quoted(c);
            }
            emit('"');return saved==null?null:saved.toString();
        }
        long number(int depth)throws Exception{
            node(depth);if(byteValue()!=3)throw fail();long bits=0;
            for(int i=0;i<8;i++)bits=(bits<<8)|byteValue();
            double d=Double.longBitsToDouble(bits);
            if(!Double.isFinite(d)||Math.abs(d)>9007199254740991L||d!=Math.rint(d))throw fail();
            long value=(long)d;emit(Long.toString(value));return value;
        }
        void generic(int depth)throws Exception {
            if(position>=size)throw fail();int tag=chunks.get(position/CHUNK)[position%CHUNK]&255;
            if(tag==4){string(4*1048576,false,depth);return;}
            if(tag==3){number(depth);return;}
            if(tag==5){int n=array(1000000,depth);emit('[');for(int i=0;i<n;i++){if(i>0)emit(',');generic(depth+1);}emit(']');return;}
            node(depth);byteValue();if(tag==0)emit("null");else if(tag==1)emit("false");else if(tag==2)emit("true");else throw fail();
        }
        void startPart()throws Exception{if(part!=null||partJson!=null||lastPartJson!=null)throw fail();part=new Sink();
            if(candidateByRow.containsKey(record)||nativeArguments!=null&&primaryRow)partJson=new PartJson();}
        String endPart()throws Exception{String s=part.finish();part.close();part=null;
            if(partJson!=null){try{lastPartJson=partJson.finish();}finally{partJson.close();partJson=null;}}return s;}
        byte[] takePartJson(){byte[] result=lastPartJson;lastPartJson=null;return result;}
        void row(String area,String db,long version,String store,String key,String body)throws Exception {
            if(record>=4096||record>=expectedRecords)throw fail();
            int ordinal=record++;
            if(!retained){
                JSONObject r=observation.getJSONArray("records").getJSONObject(ordinal);
                if(db==null)NativeRetainedAttempt.keys(r,"store","key_sha256","body_sha256");
                else{
                    NativeRetainedAttempt.keys(r,"store","database","version","object_store","key_sha256","body_sha256");
                    exact(r,"database",db);exact(r,"object_store",store);Object v=r.get("version");
                    if((!(v instanceof Integer)&&!(v instanceof Long))||((Number)v).longValue()!=version)throw fail();
                }
                exact(r,"store",area);exact(r,"key_sha256",key);exact(r,"body_sha256",body);
            }
            // These are the actual binary row domain and streamed key/body
            // digests, not row identities manufactured from diagnostic JSON.
            // Repeated IDB keys stay separate original ordinal-bound records.
            entries.add(new Record(ordinal,area,db,db==null?null:Long.valueOf(version),store,key,body));
            try{
                Integer selected=candidateByRow.get(ordinal);
                if(selected!=null){
                    var candidate=candidates.get(selected);
                    if(!area.equals(candidate.store)||!java.util.Objects.equals(db,candidate.database)
                        ||!java.util.Objects.equals(db==null?null:Long.valueOf(version),candidate.version)
                        ||!java.util.Objects.equals(store,candidate.objectStore)
                        ||!key.equals(candidate.keySha256)||!body.equals(candidate.bodySha256))throw fail();
                    boolean matched=keyJson!=null&&bodyJson!=null&&"indexedDB".equals(area)&&"mz_scan_queue".equals(db)
                        &&version>=1&&version<=6&&"actions".equals(store)
                        &&"STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED".equals(candidate.candidateState)
                        &&NativeOriginalBrowserQueuePayload.matchOriginalPayload(keyJson,bodyJson,arguments.get(selected))
                            ==NativeOriginalBrowserQueuePayload.State.MATCHED_ORIGINAL_PAYLOAD_NOT_AUTHORITY;
                    argumentMatches.set(selected,new ArgumentPayloadMatch(selected,ordinal,candidate.argumentSha256,matched));
                }
                if(nativeArguments!=null){
                    var match=unresolved(ordinal);String[] identities=null;
                    if(primaryRow&&keyJson!=null&&bodyJson!=null){
                        try(var original=NativeOriginalBrowserQueuePayload.inspectOriginalRow(keyJson,bodyJson)){
                            if(original!=null){
                                String completion=completionKey(original.deviceId,original.clientSessionId,original.clientCompletionId);
                                identities=new String[]{"primary:"+original.primaryId,"completion:"+completion,
                                    "session:"+original.deviceId+'\0'+original.clientSessionId,"operation:"+original.operationId};
                                for(String identity:identities)primaryIdentityCounts.merge(identity,1,Integer::sum);
                                var possible=nativeByCompletion.get(completion);
                                if(possible!=null&&possible.size()==1){int argument=possible.get(0);
                                    if(original.matchOriginalArgument(nativeArguments.get(argument))
                                        ==NativeOriginalBrowserQueuePayload.State.MATCHED_ORIGINAL_PAYLOAD_NOT_AUTHORITY)
                                        match=new NativeArgumentPayloadMatch(ordinal,argument,hexDigest(nativeArguments.get(argument)),true);
                                }
                            }
                        }
                    }
                    tentativeNativeMatches.add(match);nativeRowIdentities.add(identities);
                }
            }finally{if(keyJson!=null)Arrays.fill(keyJson,(byte)0);if(bodyJson!=null)Arrays.fill(bodyJson,(byte)0);keyJson=null;bodyJson=null;}
        }
        void storage(String area,int count,int depth)throws Exception{
            if(array(4096,depth)!=count)throw fail();emit('[');String previous=null;
            domains.add(new Domain(area,null,null,null,count,"DECLARED_ORIGINAL_ROWS_NOT_AUTHORITY"));
            for(int i=0;i<count;i++){
                if(i>0)emit(',');arrayExact(2,depth+1);emit('[');
                startPart();String name=string(1024,true,depth+2);String key=endPart();
                keyJson=takePartJson();
                if(previous!=null&&previous.compareTo(name)>=0)throw fail();previous=name;
                boolean hold="localStorage".equals(area)&&HOLD_KEY.equals(name);
                boolean epoch="localStorage".equals(area)&&EPOCH_KEY.equals(name);
                emit(',');startPart();String selected=string(4*1048576,hold||epoch,depth+2,hold?512:19);
                String body=endPart();emit(']');
                if(hold)originalHoldMarker=selected;
                if(epoch)originalMutationEpoch=selected;
                bodyJson=takePartJson();
                row(area,null,0,null,key,body);
            }emit(']');
        }
        void databases(int count)throws Exception{
            if(array(32,1)!=count)throw fail();emit('[');String previous=null;
            for(int i=0;i<count;i++){
                if(i>0)emit(',');arrayExact(2,2);emit('[');arrayExact(2,3);emit('[');
                String db=string(1024,true,4);
                if(previous!=null&&previous.compareTo(db)>=0)throw fail();previous=db;emit(',');
                long version=number(4);if(version<1)throw fail();emit("],");
                int stores=array(128,3);emit('[');String priorStore=null;
                if(stores==0)domains.add(new Domain("indexedDB",db,version,null,0,"DECLARED_EMPTY_DATABASE_NOT_AUTHORITY"));
                for(int j=0;j<stores;j++){
                    if(j>0)emit(',');arrayExact(2,4);emit('[');String store=string(4*1048576,true,5);
                    if(priorStore!=null&&priorStore.compareTo(store)>=0)throw fail();priorStore=store;emit(',');
                    int rows=array(4096,5);if(rows>4096-record)throw fail();emit('[');
                    domains.add(new Domain("indexedDB",db,version,store,rows,"DECLARED_ORIGINAL_ROWS_NOT_AUTHORITY"));
                    for(int k=0;k<rows;k++){
                        primaryRow="mz_scan_queue".equals(db)&&version>=1&&version<=6&&"actions".equals(store);
                        if(k>0)emit(',');arrayExact(2,6);emit('[');
                        // Encoded key/value roots are tagged arrays; their internal tags stay opaque.
                        if(position>=size||chunks.get(position/CHUNK)[position%CHUNK]!=5)throw fail();
                        startPart();generic(7);String key=endPart();emit(',');
                        keyJson=takePartJson();
                        if(position>=size||chunks.get(position/CHUNK)[position%CHUNK]!=5)throw fail();
                        startPart();generic(7);String body=endPart();emit(']');
                        bodyJson=takePartJson();
                        row("indexedDB",db,version,store,key,body);
                        primaryRow=false;
                    }emit("]]");
                }emit("]]");
            }emit(']');
        }
        void original(int local,int session,int db)throws Exception{
            arrayExact(3,0);emit("[\""+OBS+"\",{\"local\":");storage("localStorage",local,1);
            emit(",\"session\":");
            if(session==-1){node(1);if(byteValue()!=0)throw fail();emit("null");
                domains.add(new Domain("sessionStorage",null,null,null,-1,"UNAVAILABLE_UNRESOLVED_RETAINED"));}
            else storage("sessionStorage",session,1);
            emit(",\"databases\":");databases(db);emit("}]");
        }
        OriginalHeldBrowserMetadata heldMetadataAfterCompleteFrame()throws Exception {
            if(originalHoldMarker==null||originalMutationEpoch==null
                ||!originalMutationEpoch.matches("[1-9][0-9]{0,18}"))return null;
            try{if(Long.parseLong(originalMutationEpoch)<1)return null;}catch(NumberFormatException invalid){return null;}
            String prefix="{\"schema\":\"custodial.browser-preservation-hold.v1\",\"operation_id\":\"";
            String suffix="\",\"native_authority\":false}";
            if(!originalHoldMarker.startsWith(prefix)||!originalHoldMarker.endsWith(suffix)
                ||originalHoldMarker.length()<prefix.length()+suffix.length())return null;
            String operation=originalHoldMarker.substring(prefix.length(),originalHoldMarker.length()-suffix.length());
            if(!uuidText(operation))return null;
            return new OriginalHeldBrowserMetadata(operation,
                hexDigest(originalHoldMarker.getBytes(java.nio.charset.StandardCharsets.UTF_8)),originalMutationEpoch);
        }
        void close(){whole.close();if(part!=null)part.close();if(partJson!=null)partJson.close();
            for(byte[] bytes:new byte[][]{lastPartJson,keyJson,bodyJson})if(bytes!=null)Arrays.fill(bytes,(byte)0);
            lastPartJson=null;keyJson=null;bodyJson=null;entries.clear();domains.clear();argumentMatches.clear();
            originalHoldMarker=null;originalMutationEpoch=null; // String erasure is not claimed.
            nativeByCompletion.clear();primaryIdentityCounts.clear();nativeRowIdentities.clear();tentativeNativeMatches.clear();}
    }
}
