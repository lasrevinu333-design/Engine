package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/** Unmounted protected one-attempt journal. It is deliberately NOT a resend,
 * acceptance/finalizer or queue-compaction owner. An unresolved attempt cannot
 * be replaced or cleared. A DISPATCH_UNKNOWN fence is durably committed before
 * a single-use handle can reach transport. Restart can inspect, never resend. */
final class NativeRetainedAttemptJournal {
    static final String SCHEMA="custodial.native-retained-attempt-journal.v1";
    static final String PREPARED="PREPARED", UNKNOWN="DISPATCH_UNKNOWN";
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
        private final NativeRetainedAttempt original;
        private OriginalCommit(NativeRetainedAttempt original,String state,JSONObject record,Map<String,String> expected) throws VaultFailure {
            original.requireOpen();this.original=original;this.state=state;
            this.expected=Collections.unmodifiableMap(new HashMap<>(expected));
            recordHash=NativeRetainedAttempt.hash(record.toString().getBytes(StandardCharsets.UTF_8));
            identity="write:"+state+":"+recordHash;
        }
        PendingPrepared pendingPrepared(Map<String,String> expected,Map<String,String> next,NativeRetainedBatchJournal.Manifest manifest)throws VaultFailure {
            if(!PREPARED.equals(state))throw invalid();
            return new PendingPrepared(expected,next,recordHash,manifest);
        }
        void requireOpen() throws VaultFailure { original.requireOpen(); }
        void requireBatch(NativeRetainedBatchJournal.Manifest manifest,int index)throws VaultFailure {
            requireOpen();byte[] body=null;try{
                JSONObject envelope=ProviderWireJson.object(body=original.body(),NativeRetainedAttempt.MAX_BODY);
                if(!manifest.principalDigest.equals(original.principalDigest)||manifest.revision!=original.engineRevision
                    ||!manifest.wireHash.equals(original.wireSha256)
                    ||!manifest.operationId.equals(original.operationId)||!manifest.generationId.equals(original.generationId)
                    ||index!=Integer.parseInt(envelope.getString("chunk_index"))||manifest.count!=Integer.parseInt(envelope.getString("chunk_count"))
                    ||manifest.bytes!=Integer.parseInt(envelope.getString("value_bytes"))||!manifest.valueHash.equals(envelope.getString("value_sha256")))throw invalid();
            }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
            finally{if(body!=null)Arrays.fill(body,(byte)0);}
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
    NativeRetainedAttemptJournal(Backend backend,CredentialCipher cipher,Object lock) {
        if(backend==null || cipher==null || lock==null) throw new IllegalArgumentException("retained_journal_dependencies_required");
        this.backend=backend;this.cipher=cipher;this.lock=lock;
    }
    static final class Observation {
        final String state;
        private final String encoded;
        private Observation(String state,String encoded) { this.state=state;this.encoded=encoded; }
        /** Private native owner must revalidate this against original full
         * principal, vault revision, exact frozen records and credential. */
        JSONObject record() throws VaultFailure {
            try { return new JSONObject(encoded); }
            catch(Exception error) { throw invalid(error); }
        }
    }
    /** Package-private single-use capability, constructible only after the
     * durable unknown fence readback. It does NOT contain a credential. */
    static final class Dispatch implements AutoCloseable {
        private NativeRetainedAttempt attempt;
        private boolean consumed;
        private Dispatch(NativeRetainedAttempt attempt) { this.attempt=attempt; }
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
    /** Native-only read of the EXACT private all-row capture. This does not
     * recommit even an ambiguous dispatch, create a key, or open transport. */
    Observation observeCaptured(Map<String,?> expected) throws VaultFailure { synchronized(lock) {
        Map<String,String> before=raw();
        if(expected==null||!before.equals(expected))throw invalid();
        Observation value=decode(before);
        if(!before.equals(raw())||!before.equals(expected))throw invalid();
        return value;
    } }
    /** Recover only the originally attempted PREPARED request identity. This
     * read does not commit, dispatch, renew or acknowledge anything. The engine
     * still owns current-generation/capture admission and must call prepare()
     * for a true exact-ciphertext commit/readback before normal use. */
    NativeRetainedAttempt restorePendingPreparedOriginal(NativeRetainedRecordValues values,NativeProviderPrincipal principal,
        long revision,char[] credential,int chunkIndex)throws VaultFailure {
        if(values==null||principal==null||revision<0||credential==null||credential.length==0||chunkIndex<0
            ||chunkIndex>=(values.byteCount+NativeRetainedAttempt.CHUNK_BYTES-1)/NativeRetainedAttempt.CHUNK_BYTES)throw invalid();
        synchronized(lock) {
            NativeRetainedAttempt restored=null;boolean returned=false;
            try {
                PendingPrepared pending=backend.pendingPreparedOriginal();Map<String,String> before=raw();
                if(pending==null){if(!before.isEmpty())throw invalid();return null;}
                if(!before.equals(pending.expected)&&!before.equals(pending.next))throw invalid();
                Observation observation=decode(pending.next);
                if(observation==null||!PREPARED.equals(observation.state))throw invalid();
                restored=NativeRetainedAttempt.restore(observation.record(),values,principal,revision,credential);
                if(restored.chunkIndex()!=chunkIndex
                    ||!pending.recordHash.equals(NativeRetainedAttempt.hash(restored.record().toString().getBytes(StandardCharsets.UTF_8))))throw invalid();
                if(pending.manifest!=null)new OriginalCommit(restored,PREPARED,restored.record(),before).requireBatch(pending.manifest,chunkIndex);
                if(!before.equals(raw()))throw invalid();
                returned=true;return restored;
            }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
            finally{if(!returned&&restored!=null)restored.close();}
        }
    }

    void prepare(NativeRetainedAttempt attempt) throws VaultFailure {
        if(attempt==null) throw invalid();
        synchronized(lock) {
            attempt.requireOpen(); Map<String,String> prior=raw();JSONObject record=attempt.record();
            OriginalCommit original=new OriginalCommit(attempt,PREPARED,record,prior);
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
    Dispatch fenceDispatch(NativeRetainedAttempt attempt) throws VaultFailure {
        if(attempt==null) throw invalid();
        synchronized(lock) {
            attempt.requireOpen();Map<String,String> prior=raw();
            OriginalCommit original=new OriginalCommit(attempt,UNKNOWN,attempt.record(),prior);
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
                || !PREPARED.equals(index.get("state")) && !UNKNOWN.equals(index.get("state"))
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
            if(!NativeRetainedAttempt.SCHEMA.equals(record.opt("schema"))) throw invalid();
            return new Observation(index.getString("state"),encoded.toString());
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
