package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/** Unmounted protected one-query journal in a DISTINCT private namespace. It is deliberately NOT a resend,
 * acceptance/finalizer or queue-compaction owner. An unresolved query cannot
 * be replaced or cleared. A DISPATCH_UNKNOWN fence is durably committed before
 * a single-use handle can reach transport. Restart can inspect, never resend. It cannot write or clear the old write journal. */
final class NativeRetainedQueryJournal {
    static final String SCHEMA="custodial.native-retained-read-query-journal.v1";
    static final String PREPARED="PREPARED", UNKNOWN="DISPATCH_UNKNOWN", OBSERVED="READBACK_OBSERVED";
    // Existing EncryptedSecret ciphertext cap is 16 KiB. Preserve it: split
    // the ASCII prepared record into small authenticated pieces, never widen
    // the credential envelope or the frozen work-record cipher contract.
    static final int PART_CHARACTERS=4096, MAX_RECORD_CHARACTERS=540000, MAX_PARTS=132;
    static final int MAX_CIPHER_CHARACTERS=17000;
    interface Backend {
        Map<String,?> readAll() throws Exception;
        /** One synchronous commit, compare exact complete namespace first.
         * Never clear, apply, delete unknown keys, or report a false commit true. */
        boolean compareAndCommit(Map<String,String> expected,Map<String,String> next) throws Exception;
        default PendingPrepared pendingPreparedOriginal() throws Exception { return null; }
        default Map<String,String> pendingOriginal(OriginalCommit original) throws Exception { return null; }
        default boolean commitOriginal(OriginalCommit original,Map<String,String> next) throws Exception {
            original.requireOpen();return compareAndCommit(original.expected,next);
        }
    }
    /** Closed native purpose token; only this owning journal can construct it.
     * Full existing original record binds operation/generation/principal/revision.
     * It is not current engine/transport/ACK authority. */
    static final class OriginalCommit {
        final Map<String,String> expected;final String identity,state,recordHash;
        private final NativeRetainedReadQuery original;
        private OriginalCommit(NativeRetainedReadQuery original,String state,Map<String,String> expected) throws VaultFailure {
            original.requireOpen();this.original=original;this.state=state;
            this.expected=Collections.unmodifiableMap(new HashMap<>(expected));
            recordHash=NativeRetainedAttempt.hash(original.record().toString().getBytes(StandardCharsets.UTF_8));
            identity="query:"+state+":"+recordHash;
        }
        PendingPrepared pendingPrepared(Map<String,String> expected,Map<String,String> next,NativeRetainedBatchJournal.Manifest manifest)throws VaultFailure {
            if(!PREPARED.equals(state))throw invalid();
            return new PendingPrepared(expected,next,recordHash,manifest);
        }
        void requireOpen() throws VaultFailure { original.requireOpen(); }
        void requireBatch(NativeRetainedBatchJournal.Manifest manifest,int index)throws VaultFailure {
            requireOpen();try{
                JSONObject envelope=original.targetEnvelope();
                if(!manifest.principalDigest.equals(original.principalDigest)||manifest.revision!=original.engineRevision
                    ||!manifest.wireHash.equals(original.targetWireSha256)
                    ||!manifest.operationId.equals(original.operationId)||!manifest.generationId.equals(original.generationId)
                    ||index!=Integer.parseInt(envelope.getString("chunk_index"))||manifest.count!=Integer.parseInt(envelope.getString("chunk_count"))
                    ||manifest.bytes!=Integer.parseInt(envelope.getString("value_bytes"))||!manifest.valueHash.equals(envelope.getString("value_sha256")))throw invalid();
            }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}

        }
    }
    /** Opaque encrypted process memento only. No map/record getter, durability,
     * current engine admission, dispatch or response authority can escape. */
    static final class PendingPrepared {
        private final Map<String,String> expected,next;
        private final String recordHash;
        private final NativeRetainedBatchJournal.Manifest manifest;
        private PendingPrepared(Map<String,String> expected,Map<String,String> next,String recordHash,
            NativeRetainedBatchJournal.Manifest manifest) {
            this.expected=Collections.unmodifiableMap(new HashMap<>(expected));this.next=Collections.unmodifiableMap(new HashMap<>(next));
            this.recordHash=recordHash;this.manifest=manifest;
        }
    }
    private final Backend backend;
    private final CredentialCipher cipher;
    private final Object lock;
    NativeRetainedQueryJournal(Backend backend,CredentialCipher cipher,Object lock) {
        if(backend==null || cipher==null || lock==null) throw new IllegalArgumentException("retained_journal_dependencies_required");
        this.backend=backend;this.cipher=cipher;this.lock=lock;
    }
    static final class Observation {
        final String state;
        private final String encoded;
        private final String evidence;
        private Observation(String state,String encoded,String evidence) { this.state=state;this.encoded=encoded;this.evidence=evidence; }
        /** Private native owner must revalidate this against original full
         * principal, vault revision, exact frozen records and credential. */
        JSONObject record() throws VaultFailure {
            try { return new JSONObject(encoded); }
            catch(Exception error) { throw invalid(error); }
        }
        JSONObject evidence() throws VaultFailure {
            try{return evidence==null?null:new JSONObject(evidence);}catch(Exception error){throw invalid(error);}
        }
    }
    /** Package-private single-use capability, constructible only after the
     * durable unknown fence readback. It does NOT contain a credential. */
    static final class Dispatch implements AutoCloseable {
        private NativeRetainedReadQuery attempt;
        private boolean consumed;
        private Dispatch(NativeRetainedReadQuery attempt) { this.attempt=attempt; }
        synchronized AuthorizedRequest takeRequest() throws VaultFailure {
            if(consumed || attempt==null) throw invalid();
            consumed=true;
            byte[] body=attempt.body();
            try { return new AuthorizedRequest(NativeRetainedAttempt.PATH,"POST",attempt.nativeHeaders(),body); }
            finally { Arrays.fill(body,(byte)0); }
        }
        @Override public synchronized void close() { consumed=true;attempt=null; }
    }
    Observation observe() throws VaultFailure { synchronized(lock) { return decode(raw()); } }
    /** Read-only exact snapshot join. In particular, do NOT call
     * recoverObserved here: that existing path recommits ciphertext. */
    Observation observeCaptured(Map<String,?> expected) throws VaultFailure { synchronized(lock) {
        Map<String,String> before=raw();
        if(expected==null||!before.equals(expected))throw invalid();
        Observation value=decode(before);
        if(!before.equals(raw())||!before.equals(expected))throw invalid();
        return value;
    } }
    /** Encrypted process memento, never durable observation/absence/response
     * proof. Only existing full original-target/HMAC restore can return a typed
     * query. Main retains currentness and the required true prepare() commit. */
    NativeRetainedReadQuery restorePendingPreparedOriginal(NativeRetainedAttempt target,NativeProviderPrincipal principal,
        long revision,char[] credential)throws VaultFailure {
        if(target==null||principal==null||revision<0||credential==null||credential.length==0)throw invalid();
        target.requireOpen();
        if(!target.principalDigest.equals(principal.digest)||target.engineRevision!=revision)throw invalid();
        synchronized(lock) {
            NativeRetainedReadQuery restored=null;boolean returned=false;
            try {
                PendingPrepared pending=backend.pendingPreparedOriginal();Map<String,String> before=raw();
                if(pending==null){if(!before.isEmpty())throw invalid();return null;}
                if(!before.equals(pending.expected)&&!before.equals(pending.next))throw invalid();
                Observation observation=decode(pending.next);
                if(observation==null||!PREPARED.equals(observation.state))throw invalid();
                restored=NativeRetainedReadQuery.restore(observation.record(),target,principal,revision,credential);
                if(!pending.recordHash.equals(NativeRetainedAttempt.hash(restored.record().toString().getBytes(StandardCharsets.UTF_8))))throw invalid();
                if(pending.manifest!=null)new OriginalCommit(restored,PREPARED,before).requireBatch(pending.manifest,target.chunkIndex());
                if(!before.equals(raw()))throw invalid();
                returned=true;return restored;
            }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
            finally{if(!returned&&restored!=null)restored.close();}
        }
    }

    void prepare(NativeRetainedReadQuery attempt) throws VaultFailure {
        if(attempt==null) throw invalid();
        synchronized(lock) {
            attempt.requireOpen(); Map<String,String> prior=raw();JSONObject record=attempt.record();
            OriginalCommit original=new OriginalCommit(attempt,PREPARED,prior);
            Map<String,String> pending=pending(original);
            if(pending!=null){commit(original,pending);return;}
            Observation existing=decode(prior);
            if(existing!=null) {
                if(!PREPARED.equals(existing.state) || !same(record,existing.record())) throw invalid();
                // Exact ciphertext recommit is required after an ambiguous
                // SharedPreferences false commit; volatile getAll is not disk proof.
                commit(original,prior);return;
            }
            commit(original,encode(PREPARED,record));
        }
    }
    Dispatch fenceDispatch(NativeRetainedReadQuery attempt) throws VaultFailure {
        if(attempt==null) throw invalid();
        synchronized(lock) {
            attempt.requireOpen();Map<String,String> prior=raw();
            OriginalCommit original=new OriginalCommit(attempt,UNKNOWN,prior);
            Map<String,String> pending=pending(original);
            // A recovered UNKNOWN fence never produces another dispatch handle.
            if(pending!=null){commit(original,pending);throw invalid();}
            Observation existing=decode(prior);
            if(existing==null || !PREPARED.equals(existing.state) || !same(attempt.record(),existing.record())) throw invalid();
            // No network is called anywhere in this class. Even death between
            // this commit and transport remains UNKNOWN, not permission to resend.
            commit(original,encode(UNKNOWN,attempt.record()));
            return new Dispatch(attempt);
        }
    }
    /** Persist only a typed VERIFIED read observation. This does not resolve,
     * replace, acknowledge or clear the independent original WRITE journal. */
    void observeReadback(NativeRetainedReadQuery query,NativeRetainedReadbackEvidence evidence) throws VaultFailure {
        if(query==null||evidence==null)throw invalid();
        synchronized(lock){
            Map<String,String> prior=raw();
            try{JSONObject record=query.record().put("readback_evidence",evidence.storage(query));
                OriginalCommit original=new OriginalCommit(query,OBSERVED,prior);
                Map<String,String> pending=pending(original);
                if(pending!=null){
                    Observation retained=decode(pending);
                    if(retained==null||!OBSERVED.equals(retained.state)||!same(query.record(),retained.record())
                        ||!same(evidence.storage(query),retained.evidence()))throw invalid();
                    commit(original,pending);return;
                }
                Observation existing=decode(prior);
                if(existing==null||!UNKNOWN.equals(existing.state)||!same(query.record(),existing.record()))throw invalid();
                commit(original,encode(OBSERVED,record));}
            catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
        }
    }
    /** Cached-only typed result. Cannot be passed to observeReadback or a writer.
     * Constructible here ONLY after a true exact-ciphertext recommit/readback. */
    static final class RecoveredObservation {
        final boolean currentServerReadback=false,freshQueryPerformed=false,resendAllowed=false;
        final boolean workAccepted=false,inventoryAcknowledged=false,keyRemovalAllowed=false;
        final String status,queryRequestId,targetRequestId;
        private final String encoded;
        private RecoveredObservation(JSONObject value)throws Exception{
            encoded=value.toString();status=value.getString("status");queryRequestId=value.getString("query_native_request_id");targetRequestId=value.getString("native_request_id");
        }
        JSONObject metadata()throws VaultFailure{try{return new JSONObject(encoded);}catch(Exception error){throw invalid(error);}}
    }
    RecoveredObservation recoverObserved(NativeRetainedReadQuery query)throws VaultFailure{
        if(query==null)throw invalid();
        synchronized(lock){
            Map<String,String> prior=raw();
            // Only the actual original query can request its OBSERVED retry.
            // Pending bytes are never returned by raw(), nor taken as durable
            // or fresh evidence. The already-attempted exact candidate must pass
            // owning crypto/evidence validation and true whole readback first.
            OriginalCommit original=new OriginalCommit(query,OBSERVED,prior);
            Map<String,String> candidate=pending(original);
            Observation observed=decode(candidate==null?prior:candidate);
            JSONObject metadata=NativeRetainedReadbackEvidence.validateStoredObservation(query,observed);
            commit(original,candidate==null?prior:candidate);
            try{return new RecoveredObservation(metadata);}catch(Exception error){throw invalid(error);}
        }
    }
    private Map<String,String> pending(OriginalCommit original) throws VaultFailure {
        try{return backend.pendingOriginal(original);}
        catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
    }
    private void commit(OriginalCommit original,Map<String,String> next) throws VaultFailure {
        try {
            if(!backend.commitOriginal(original,Collections.unmodifiableMap(new HashMap<>(next)))) throw invalid();
            Map<String,String> readback=raw();
            if(!next.equals(readback) || decode(readback)==null) throw invalid();
        } catch(VaultFailure error) { throw error; }
        catch(Exception error) { throw invalid(error); }
    }
    private Map<String,String> raw() throws VaultFailure {
        try {
            Map<String,?> supplied=backend.readAll();
            if(supplied==null || supplied.size()>MAX_PARTS+1) throw invalid();
            Map<String,String> result=new HashMap<>();
            for(Map.Entry<String,?> entry:supplied.entrySet()) {
                String key=entry.getKey();Object value=entry.getValue();
                if(key==null || !(key.equals("index") || key.matches("part:(?:0|[1-9][0-9]{0,2})") && Integer.parseInt(key.substring(5))<MAX_PARTS)
                    || !(value instanceof String) || ((String)value).length()<1 || ((String)value).length()>MAX_CIPHER_CHARACTERS) throw invalid();
                result.put(key,(String)value);
            }
            return result;
        } catch(VaultFailure error) { throw error; }
        catch(Exception error) { throw invalid(error); }
    }
    private Map<String,String> encode(String state,JSONObject record) throws VaultFailure {
        try {
            String encoded=record.toString();
            if(encoded.length()<1 || encoded.length()>MAX_RECORD_CHARACTERS) throw invalid();
            int count=(encoded.length()+PART_CHARACTERS-1)/PART_CHARACTERS;
            Map<String,String> out=new HashMap<>();
            for(int part=0;part<count;part++) {
                String key="part:"+part;
                JSONObject value=new JSONObject().put("id",key).put("value",encoded.substring(part*PART_CHARACTERS,Math.min(encoded.length(),(part+1)*PART_CHARACTERS)));
                out.put(key,protect(value));
            }
            out.put("index",protect(new JSONObject().put("schema",SCHEMA).put("state",state).put("parts",count)
                .put("characters",encoded.length()).put("record_sha256",NativeRetainedAttempt.hash(encoded.getBytes(StandardCharsets.UTF_8)))));
            return out;
        } catch(VaultFailure error) { throw error; }
        catch(Exception error) { throw invalid(error); }
    }
    private Observation decode(Map<String,String> raw) throws VaultFailure {
        if(raw.isEmpty()) return null;
        try {
            JSONObject index=unprotect(raw.get("index"));
            NativeRetainedAttempt.keys(index,"schema","state","parts","characters","record_sha256");
            Object n=index.get("parts"),c=index.get("characters");
            if(!SCHEMA.equals(index.get("schema")) || !(index.get("state") instanceof String)
                || !PREPARED.equals(index.get("state")) && !UNKNOWN.equals(index.get("state")) && !OBSERVED.equals(index.get("state"))
                || !(n instanceof Integer || n instanceof Long) || !(c instanceof Integer || c instanceof Long)) throw invalid();
            long countValue=((Number)n).longValue(),characterValue=((Number)c).longValue();
            if(countValue<1 || countValue>MAX_PARTS || characterValue<1 || characterValue>MAX_RECORD_CHARACTERS) throw invalid();
            int count=(int)countValue,characters=(int)characterValue;
            if(count<1 || count>MAX_PARTS || characters<1 || characters>MAX_RECORD_CHARACTERS
                || count!=(characters+PART_CHARACTERS-1)/PART_CHARACTERS || raw.size()!=count+1) throw invalid();
            StringBuilder encoded=new StringBuilder(characters);
            for(int part=0;part<count;part++) {
                String key="part:"+part;JSONObject value=unprotect(raw.get(key));
                NativeRetainedAttempt.keys(value,"id","value");
                if(!key.equals(value.get("id")) || !(value.get("value") instanceof String)
                    || value.getString("value").length()!=Math.min(PART_CHARACTERS,characters-part*PART_CHARACTERS)) throw invalid();
                encoded.append(value.getString("value"));
            }
            if(!NativeRetainedAttempt.hash(encoded.toString().getBytes(StandardCharsets.UTF_8)).equals(index.get("record_sha256"))) throw invalid();
            JSONObject record=ProviderWireJson.object(encoded.toString().getBytes(StandardCharsets.UTF_8),MAX_RECORD_CHARACTERS);
            if(!NativeRetainedReadQuery.SCHEMA.equals(record.opt("schema"))) throw invalid();
            String state=index.getString("state"),evidence=null;
            if(OBSERVED.equals(state)){Object result=record.remove("readback_evidence");if(!(result instanceof JSONObject))throw invalid();evidence=result.toString();}
            else if(record.has("readback_evidence"))throw invalid();
            return new Observation(state,record.toString(),evidence);
        } catch(VaultFailure error) { throw error; }
        catch(Exception error) { throw invalid(error); }
    }
    private String protect(JSONObject value) throws VaultFailure {
        char[] clear=null;
        try {
            clear=value.toString().toCharArray();
            if(clear.length>2*PART_CHARACTERS+1024) throw invalid();
            EncryptedSecret secret=cipher.encryptWithExistingKey(clear); // NEVER create/rotate/delete any key.
            String out=new JSONObject().put("ciphertext",secret.ciphertext).put("iv",secret.iv).toString();
            if(out.length()>MAX_CIPHER_CHARACTERS) throw invalid();return out;
        } catch(VaultFailure error) { throw error; }
        catch(Exception error) { throw invalid(error); }
        finally { if(clear!=null) Arrays.fill(clear,'\0'); }
    }
    private JSONObject unprotect(String wire) throws VaultFailure {
        char[] clear=null;
        try {
            if(wire==null || wire.length()>MAX_CIPHER_CHARACTERS) throw invalid();
            JSONObject envelope=ProviderWireJson.object(wire.getBytes(StandardCharsets.UTF_8),MAX_CIPHER_CHARACTERS);
            NativeRetainedAttempt.keys(envelope,"ciphertext","iv");
            if(!(envelope.get("ciphertext") instanceof String) || !(envelope.get("iv") instanceof String)) throw invalid();
            clear=cipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
            if(clear.length>2*PART_CHARACTERS+1024) throw invalid();
            return ProviderWireJson.object(new String(clear).getBytes(StandardCharsets.UTF_8),2*PART_CHARACTERS+1024);
        } catch(VaultFailure error) { throw error; }
        catch(Exception error) { throw invalid(error); }
        finally { if(clear!=null) Arrays.fill(clear,'\0'); }
    }
    private static VaultFailure invalid() { return new VaultFailure(NativeRetainedAttempt.FAILURE); }
    private static boolean same(JSONObject first,JSONObject second) throws VaultFailure {
        try { return ProviderWireJson.same(first,second); }
        catch(Exception error) { throw invalid(error); }
    }
    private static VaultFailure invalid(Exception error) { return new VaultFailure(NativeRetainedAttempt.FAILURE,error); }
}
