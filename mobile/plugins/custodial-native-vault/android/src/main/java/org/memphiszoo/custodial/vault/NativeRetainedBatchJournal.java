package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/** Unmounted bounded native batch owner. Chunk zero remains in its ORIGINAL
 * attempt/query namespaces and AAD. Later chunks have fixed append-only slots;
 * no overwrite, clear, arbitrary signer, resend, acceptance or key API exists. */
final class NativeRetainedBatchJournal {
    static final String SCHEMA="custodial.native-retained-batch-owner.v1", INDEX="batch:index";
    static final int MAX_CHUNKS=(NativeRetainedRecordValues.MAX_BYTES+NativeRetainedAttempt.CHUNK_BYTES-1)/NativeRetainedAttempt.CHUNK_BYTES;
    interface Backend {
        Map<String,?> readAll() throws Exception;
        boolean compareAndCommit(Map<String,String> expected,Map<String,String> next) throws Exception;
        default Map<String,String> pendingOriginal(OriginalCommit original) throws Exception { return null; }
        default NativeRetainedAttemptJournal.PendingPrepared pendingPreparedWrite(Manifest manifest,int index)throws Exception { return null; }
        default NativeRetainedQueryJournal.PendingPrepared pendingPreparedQuery(Manifest manifest,int index)throws Exception { return null; }
        default OriginalCommit pendingPreparation() throws Exception { return null; }
        default boolean commitOriginal(OriginalCommit original,Map<String,String> next) throws Exception {
            original.requireOpen();return compareAndCommit(original.expected,next);
        }
    }
    interface Ciphers { CredentialCipher slot(boolean query,int index) throws VaultFailure; }
    static final class Manifest {
        final String operationId,generationId,principalDigest,wireHash,valueHash;
        final int count,bytes;final long revision;
        private final String encoded;
        private Manifest(JSONObject value)throws Exception{
            NativeRetainedAttempt.keys(value,"schema","operation_id","generation_id","principal_digest","engine_revision","wire_sha256","value_sha256","value_bytes","chunk_count","chunk_bytes");
            require(value,"schema",SCHEMA);require(value,"chunk_bytes",NativeRetainedAttempt.CHUNK_BYTES);
            operationId=value.getString("operation_id");generationId=value.getString("generation_id");
            for(String id:new String[]{operationId,generationId})if(!id.matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))throw invalid();
            principalDigest=value.getString("principal_digest");wireHash=value.getString("wire_sha256");valueHash=value.getString("value_sha256");
            for(String hash:new String[]{principalDigest,wireHash,valueHash})if(!hash.matches("[a-f0-9]{64}"))throw invalid();
            for(String field:new String[]{"schema","operation_id","generation_id","principal_digest","wire_sha256","value_sha256"})if(!(value.get(field) instanceof String))throw invalid();
            revision=number(value,"engine_revision");long b=number(value,"value_bytes"),c=number(value,"chunk_count");
            if(b<1||b>NativeRetainedRecordValues.MAX_BYTES||c<1||c>MAX_CHUNKS||c!=(b+NativeRetainedAttempt.CHUNK_BYTES-1)/NativeRetainedAttempt.CHUNK_BYTES)throw invalid();
            bytes=(int)b;count=(int)c;encoded=value.toString();
        }
        JSONObject json()throws Exception{return new JSONObject(encoded);}
    }
    /** Constructible only in owning preparation or a typed child journal call.
     * Observing/decrypting a Manifest alone cannot mint this commit token. */
    static final class OriginalCommit {
        final Manifest manifest;final String identity,purpose;final Map<String,String> expected;
        private final NativeProviderJournal.OriginalGeneration generation;
        private final NativeProviderPrincipal principal;
        private final NativeRetainedAttemptJournal.OriginalCommit write;
        private final NativeRetainedQueryJournal.OriginalCommit query;
        private OriginalCommit(NativeProviderJournal.OriginalGeneration generation,NativeProviderPrincipal principal,
            Manifest manifest,Map<String,String> expected) throws Exception {
            generation.requireCurrent(principal);
            if(!generation.generationId.equals(manifest.generationId)||!principal.digest.equals(manifest.principalDigest))throw invalid();
            this.manifest=manifest;this.generation=generation;this.principal=principal;write=null;query=null;purpose="prepare";
            this.expected=Collections.unmodifiableMap(new HashMap<>(expected));
            identity="batch:prepare:"+NativeRetainedAttempt.hash(manifest.json().toString().getBytes(StandardCharsets.UTF_8));
        }
        private OriginalCommit(Manifest manifest,int index,NativeRetainedAttemptJournal.OriginalCommit write,
            NativeRetainedQueryJournal.OriginalCommit query,Map<String,String> expected)throws Exception {
            if((write==null)==(query==null)||index<1||index>=manifest.count)throw invalid();
            if(write!=null)write.requireBatch(manifest,index);
            if(query!=null)query.requireBatch(manifest,index);
            this.manifest=manifest;this.generation=null;this.principal=null;this.write=write;this.query=query;
            purpose=(query!=null?"query:":"write:")+index;this.expected=Collections.unmodifiableMap(new HashMap<>(expected));
            identity="batch:"+purpose+":"+NativeRetainedAttempt.hash(manifest.json().toString().getBytes(StandardCharsets.UTF_8))
                +":"+(write!=null?write.identity:query.identity);
        }
        NativeRetainedAttemptJournal.PendingPrepared pendingWrite(Manifest expected,int index,Map<String,String> before,Map<String,String> next)throws VaultFailure {
            try {
                if(write==null||query!=null||!purpose.equals("write:"+index)||!ProviderWireJson.same(expected.json(),manifest.json()))throw invalid();
                String prefix="write:"+index+":";
                return write.pendingPrepared(preparedPart(before,prefix),preparedPart(next,prefix),manifest);
            }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
        }
        NativeRetainedQueryJournal.PendingPrepared pendingQuery(Manifest expected,int index,Map<String,String> before,Map<String,String> next)throws VaultFailure {
            try {
                if(query==null||write!=null||!purpose.equals("query:"+index)||!ProviderWireJson.same(expected.json(),manifest.json()))throw invalid();
                String prefix="query:"+index+":";
                return query.pendingPrepared(preparedPart(before,prefix),preparedPart(next,prefix),manifest);
            }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid(error);}
        }
        private static Map<String,String> preparedPart(Map<String,String> all,String prefix) {
            Map<String,String> part=new HashMap<>();
            for(var entry:all.entrySet())if(entry.getKey().startsWith(prefix))part.put(entry.getKey().substring(prefix.length()),entry.getValue());
            return part;
        }
        void requireOpen()throws VaultFailure {
            if(generation!=null) {
                if(!Thread.holdsLock(generation.originalCommitCoordinator()))throw invalid();
                generation.requireCurrent(principal);
            }
            else if(write!=null)write.requireOpen();else query.requireOpen();
        }
    }
    private final Backend backend;private final CredentialCipher cipher;private final Ciphers ciphers;private final Object lock;
    private final NativeRetainedAttemptJournal zeroWrite;private final NativeRetainedQueryJournal zeroQuery;
    NativeRetainedBatchJournal(Backend backend,CredentialCipher cipher,Ciphers ciphers,Object lock,
        NativeRetainedAttemptJournal zeroWrite,NativeRetainedQueryJournal zeroQuery){
        if(backend==null||cipher==null||ciphers==null||lock==null||zeroWrite==null||zeroQuery==null)throw new IllegalArgumentException("native_batch_dependencies_required");
        this.backend=backend;this.cipher=cipher;this.ciphers=ciphers;this.lock=lock;this.zeroWrite=zeroWrite;this.zeroQuery=zeroQuery;
    }
    Manifest prepare(NativeRetainedWorkCapture capture,NativeProviderPrincipal principal,long revision,char[] credential,
        NativeProviderJournal.OriginalGeneration originalGeneration,HttpsEnrollmentTransport.RequestIdGenerator ids)throws VaultFailure{
        if(originalGeneration==null)throw invalid();
        synchronized(originalGeneration.originalCommitCoordinator()){synchronized(lock){try{
            if(capture==null||principal==null||revision<0||ids==null||originalGeneration==null)throw invalid();
            originalGeneration.requireCurrent(principal);
            Map<String,String> before=raw();Manifest value;
            OriginalCommit pending=backend.pendingPreparation();
            if(pending!=null) {
                value=pending.manifest;requireCapture(value,capture,principal,revision);
                if(!originalGeneration.generationId.equals(value.generationId))throw invalid();
                originalGeneration.requireCurrent(principal);
                if("prepare".equals(pending.purpose)) {
                    OriginalCommit original=new OriginalCommit(originalGeneration,principal,value,before);
                    Map<String,String> candidate=backend.pendingOriginal(original);
                    if(candidate==null)throw invalid();commit(original,candidate,value);
                } else {
                    // An unrelated unresolved slot is NOT durability proof.
                    // Keep it pending for that exact typed child journal to retry.
                    if(!ProviderWireJson.same(value.json(),manifest(before).json()))throw invalid();
                }
                originalGeneration.requireCurrent(principal);return value;
            }
            if(before.isEmpty()){
                NativeRetainedAttemptJournal.Observation original=zeroWrite.observe();NativeRetainedQueryJournal.Observation query=zeroQuery.observe();
                String operation,generation;
                if(original==null){if(query!=null)throw invalid();operation=ids.next();generation=originalGeneration.generationId;}
                else try(NativeRetainedAttempt attempt=NativeRetainedAttempt.restore(original.record(),capture.values,principal,revision,credential)){
                    if(attempt.chunkIndex()!=0)throw invalid();operation=attempt.operationId;generation=attempt.generationId;
                    if(query!=null)try(NativeRetainedReadQuery restored=NativeRetainedReadQuery.restore(query.record(),attempt,principal,revision,credential)){restored.requireOpen();}
                }
                if(!originalGeneration.generationId.equals(generation))throw invalid();
                originalGeneration.requireCurrent(principal);
                value=new Manifest(new JSONObject().put("schema",SCHEMA).put("operation_id",operation).put("generation_id",generation)
                    .put("principal_digest",principal.digest).put("engine_revision",revision).put("wire_sha256",wireHash(capture))
                    .put("value_sha256",capture.values.sha256).put("value_bytes",capture.values.byteCount)
                    .put("chunk_count",(capture.values.byteCount+NativeRetainedAttempt.CHUNK_BYTES-1)/NativeRetainedAttempt.CHUNK_BYTES)
                    .put("chunk_bytes",NativeRetainedAttempt.CHUNK_BYTES));
                Map<String,String> next=new HashMap<>();next.put(INDEX,protect(value.json()));
                originalGeneration.requireCurrent(principal);commit(new OriginalCommit(originalGeneration,principal,value,before),next,value);
            }else{
                value=manifest(before);requireCapture(value,capture,principal,revision);
                if(!originalGeneration.generationId.equals(value.generationId))throw invalid();
                // A false SharedPreferences commit may be visible only in memory.
                // Recommit the EXACT complete ciphertext without allocating IDs.
                originalGeneration.requireCurrent(principal);
                commit(new OriginalCommit(originalGeneration,principal,value,before),before,value);
            }
            requireCapture(value,capture,principal,revision);originalGeneration.requireCurrent(principal);return value;
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}}}
    }
    void requireBound(Manifest expected,NativeRetainedWorkCapture capture,NativeProviderPrincipal principal,long revision)throws VaultFailure{
        synchronized(lock){try{Manifest actual=manifest(raw());if(!ProviderWireJson.same(expected.json(),actual.json()))throw invalid();requireCapture(actual,capture,principal,revision);}
        catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}}
    }
    Manifest observe()throws VaultFailure{synchronized(lock){try{return manifest(raw());}catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}}}
    /** Exact all-row source capture; empty is not a fabricated manifest. All
     * layout validation and original capture/principal checks remain owning. */
    Manifest observeCaptured(Map<String,?> expected,NativeRetainedWorkCapture capture,
        NativeProviderPrincipal principal,long revision)throws VaultFailure{
        synchronized(lock){try{
            Map<String,String> before=raw();if(expected==null||!before.equals(expected))throw invalid();
            Manifest value=before.isEmpty()?null:manifest(before);
            if(value!=null)requireCapture(value,capture,principal,revision);
            if(!before.equals(raw())||!before.equals(expected))throw invalid();return value;
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}}
    }
    NativeRetainedAttemptJournal writes(Manifest manifest,int index)throws VaultFailure{
        requireIndex(manifest,index);if(index==0)return zeroWrite;
        return new NativeRetainedAttemptJournal(new NativeRetainedAttemptJournal.Backend(){
            public Map<String,?> readAll()throws Exception{return slotRaw(manifest,false,index);}
            public boolean compareAndCommit(Map<String,String> expected,Map<String,String> next)throws Exception{throw invalid();}
            public NativeRetainedAttemptJournal.PendingPrepared pendingPreparedOriginal()throws Exception{
                synchronized(lock){requireIndex(manifest,index);return backend.pendingPreparedWrite(manifest,index);}
            }
            public Map<String,String> pendingOriginal(NativeRetainedAttemptJournal.OriginalCommit original)throws Exception{
                return pendingSlot(manifest,false,index,original,null);}
            public boolean commitOriginal(NativeRetainedAttemptJournal.OriginalCommit original,Map<String,String> next)throws Exception{
                return commitSlot(manifest,false,index,original.expected,next,original,null);}
        },ciphers.slot(false,index),lock);
    }
    NativeRetainedQueryJournal reads(Manifest manifest,int index)throws VaultFailure{
        requireIndex(manifest,index);if(index==0)return zeroQuery;
        return new NativeRetainedQueryJournal(new NativeRetainedQueryJournal.Backend(){
            public Map<String,?> readAll()throws Exception{return slotRaw(manifest,true,index);}
            public boolean compareAndCommit(Map<String,String> expected,Map<String,String> next)throws Exception{throw invalid();}
            public NativeRetainedQueryJournal.PendingPrepared pendingPreparedOriginal()throws Exception{
                synchronized(lock){requireIndex(manifest,index);return backend.pendingPreparedQuery(manifest,index);}
            }
            public Map<String,String> pendingOriginal(NativeRetainedQueryJournal.OriginalCommit original)throws Exception{
                return pendingSlot(manifest,true,index,null,original);}
            public boolean commitOriginal(NativeRetainedQueryJournal.OriginalCommit original,Map<String,String> next)throws Exception{
                return commitSlot(manifest,true,index,original.expected,next,null,original);}
        },ciphers.slot(true,index),lock);
    }
    private Map<String,String> slotRaw(Manifest expected,boolean query,int index)throws Exception{
        synchronized(lock){Map<String,String> all=raw();Manifest actual=manifest(all);if(!ProviderWireJson.same(expected.json(),actual.json()))throw invalid();
            String prefix=prefix(query,index);Map<String,String> part=new HashMap<>();for(var entry:all.entrySet())if(entry.getKey().startsWith(prefix))part.put(entry.getKey().substring(prefix.length()),entry.getValue());return part;}
    }
    private Map<String,String> pendingSlot(Manifest expected,boolean query,int index,
        NativeRetainedAttemptJournal.OriginalCommit write,NativeRetainedQueryJournal.OriginalCommit read)throws Exception{
        synchronized(lock){
            Map<String,String> all=raw();Manifest actual=manifest(all);
            if(!ProviderWireJson.same(expected.json(),actual.json())
                ||!(write!=null?write.expected:read.expected).equals(slotRaw(expected,query,index)))throw invalid();
            Map<String,String> pending=backend.pendingOriginal(new OriginalCommit(expected,index,write,read,all));
            if(pending==null)return null;
            String prefix=prefix(query,index);Map<String,String> part=new HashMap<>();
            for(var entry:pending.entrySet())if(entry.getKey().startsWith(prefix))part.put(entry.getKey().substring(prefix.length()),entry.getValue());
            return Collections.unmodifiableMap(part);
        }
    }
    private boolean commitSlot(Manifest expected,boolean query,int index,Map<String,String> before,Map<String,String> next,
        NativeRetainedAttemptJournal.OriginalCommit write,NativeRetainedQueryJournal.OriginalCommit read)throws Exception{
        synchronized(lock){if(before==null||next==null||!next.keySet().containsAll(before.keySet()))throw invalid();
            Map<String,String> all=raw();Manifest actual=manifest(all);if(!ProviderWireJson.same(expected.json(),actual.json())||!before.equals(slotRaw(expected,query,index)))throw invalid();
            String prefix=prefix(query,index);Map<String,String> complete=new HashMap<>(all);for(var entry:next.entrySet())complete.put(prefix+entry.getKey(),entry.getValue());
            validateLayout(complete,actual);if(!backend.commitOriginal(new OriginalCommit(actual,index,write,read,all),Collections.unmodifiableMap(complete)))return false;
            Map<String,String> readback=raw();if(!complete.equals(readback)||!ProviderWireJson.same(expected.json(),manifest(readback).json()))throw invalid();return true;}
    }
    private static String prefix(boolean query,int index){return (query?"query:":"write:")+index+":";}
    private void requireIndex(Manifest expected,int index)throws VaultFailure{
        synchronized(lock){try{if(expected==null||index<0||index>=expected.count||!ProviderWireJson.same(expected.json(),manifest(raw()).json()))throw invalid();}
        catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}}
    }
    private Map<String,String> raw()throws Exception{
        Map<String,?> given=backend.readAll();if(given==null||given.size()>1+(MAX_CHUNKS-1)*2*(NativeRetainedAttemptJournal.MAX_PARTS+1))throw invalid();
        Map<String,String> copy=new HashMap<>();for(var entry:given.entrySet()){
            if(entry.getKey()==null||!(entry.getValue() instanceof String)||((String)entry.getValue()).isEmpty()||((String)entry.getValue()).length()>NativeRetainedAttemptJournal.MAX_CIPHER_CHARACTERS)throw invalid();
            copy.put(entry.getKey(),(String)entry.getValue());}
        if(!copy.isEmpty())validateLayout(copy,unprotectManifest(copy.get(INDEX)));return copy;
    }
    private Manifest manifest(Map<String,String> raw)throws Exception{if(raw.isEmpty())throw invalid();Manifest value=unprotectManifest(raw.get(INDEX));validateLayout(raw,value);return value;}
    private void commit(OriginalCommit original,Map<String,String> next,Manifest value)throws Exception{
        validateLayout(next,value);if(!backend.commitOriginal(original,Collections.unmodifiableMap(next)))throw invalid();
        Map<String,String> back=raw();if(!next.equals(back)||!ProviderWireJson.same(value.json(),manifest(back).json()))throw invalid();
    }
    private static void validateLayout(Map<String,String> raw,Manifest value)throws VaultFailure{
        if(!raw.containsKey(INDEX)||raw.size()>1+(value.count-1)*2*(NativeRetainedAttemptJournal.MAX_PARTS+1))throw invalid();
        for(String key:raw.keySet())if(!INDEX.equals(key)){
            if(!key.matches("(?:write|query):[1-9][0-9]{0,3}:(?:index|part:(?:0|[1-9][0-9]{0,2}))"))throw invalid();
            String[] pieces=key.split(":");int index=Integer.parseInt(pieces[1]);if(index>=value.count||pieces.length==4&&Integer.parseInt(pieces[3])>=NativeRetainedAttemptJournal.MAX_PARTS)throw invalid();
        }
    }
    private static void requireCapture(Manifest value,NativeRetainedWorkCapture capture,NativeProviderPrincipal principal,long revision)throws Exception{
        if(!value.principalDigest.equals(principal.digest)||value.revision!=revision||value.bytes!=capture.values.byteCount
            ||!value.valueHash.equals(capture.values.sha256)||!value.wireHash.equals(wireHash(capture)))throw invalid();
    }
    private static String wireHash(NativeRetainedWorkCapture capture)throws Exception{return NativeRetainedAttempt.hash(capture.wire().toString().getBytes(StandardCharsets.UTF_8));}
    private String protect(JSONObject value)throws VaultFailure{
        char[] clear=value.toString().toCharArray();try{if(clear.length>4096)throw invalid();EncryptedSecret encrypted=cipher.encryptWithExistingKey(clear);
            return new JSONObject().put("ciphertext",encrypted.ciphertext).put("iv",encrypted.iv).toString();}
        catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}finally{Arrays.fill(clear,'\0');}
    }
    private Manifest unprotectManifest(String value)throws VaultFailure{
        char[] clear=null;try{if(value==null||value.length()>NativeRetainedAttemptJournal.MAX_CIPHER_CHARACTERS)throw invalid();
            JSONObject envelope=ProviderWireJson.object(value.getBytes(StandardCharsets.UTF_8),NativeRetainedAttemptJournal.MAX_CIPHER_CHARACTERS);
            NativeRetainedAttempt.keys(envelope,"ciphertext","iv");if(!(envelope.get("ciphertext") instanceof String)||!(envelope.get("iv") instanceof String))throw invalid();
            clear=cipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));if(clear.length>4096)throw invalid();
            return new Manifest(ProviderWireJson.object(new String(clear).getBytes(StandardCharsets.UTF_8),4096));
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}finally{if(clear!=null)Arrays.fill(clear,'\0');}
    }
    private static long number(JSONObject value,String field)throws Exception{Object n=value.get(field);if(!(n instanceof Integer||n instanceof Long))throw invalid();long out=((Number)n).longValue();if(out<0||out>9007199254740991L)throw invalid();return out;}
    private static void require(JSONObject value,String field,Object expected)throws Exception{Object actual=value.get(field);if(expected instanceof Number){if(number(value,field)!=((Number)expected).longValue())throw invalid();}else if(!expected.equals(actual))throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure(NativeRetainedAttempt.FAILURE);}
    private static VaultFailure invalid(Exception error){return new VaultFailure(NativeRetainedAttempt.FAILURE,error);}
}
