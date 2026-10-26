package org.memphiszoo.custodial.vault;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

/** UNMOUNTED, VOLATILE native-only capsule. No raw/ciphertext getter, decoder,
 * callback, persistence, transport, server receipt or retirement authority.
 * Production obtains ONLY the existing shared-V2 AndroidKeyStore key through
 * the fixed adapter. Test keys are synthetic. Each fixed chunk has fresh GCM
 * IV and a distinct, length-framed AAD binding the entire original layout.
 * Recovery here means exact round-trip while that SAME device key survives;
 * NOT key-loss, cross-device, legacy-key retirement or application recovery.
 */
final class NativeRetainedNamespacePrivateCapsule implements AutoCloseable {
    static final String SCHEMA="custodial.native-retained-eight-private-capsule.v1";
    static final String AAD_DOMAIN="org.memphiszoo.custodial.native-retained-eight-capsule.v1";
    static final String FAILURE="custodial_native_all8_private_capsule_unknown";
    private static final String TRANSFORMATION="AES/GCM/NoPadding";
    /** Portable crypto check on decoded ORIGINAL vault ciphertext, not a
     * plaintext/credential exporter or caller-selected AAD. Fixed adapter is
     * the sole product caller; key and envelope bytes are never returned. */
    static void requireOriginalVaultAndWorkKey(SecretKey key,byte[] encrypted,byte[] iv,
        NativeRetainedWorkCapture frozenWork,NativeProviderPrincipal principal)throws VaultFailure {
        byte[] clear=null;char[] credential=null;java.nio.CharBuffer characters=null;
        try {
            requireKey(key);
            if(encrypted==null||encrypted.length<17||encrypted.length>16400||iv==null||iv.length!=12||frozenWork==null||principal==null)throw invalid();
            Cipher cipher=Cipher.getInstance(TRANSFORMATION);cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,iv));
            cipher.updateAAD("org.memphiszoo.custodial.native-vault.snapshot.v2".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            clear=cipher.doFinal(encrypted);characters=java.nio.charset.StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                .decode(java.nio.ByteBuffer.wrap(clear));credential=new char[characters.remaining()];characters.get(credential);
            NativeAttestation.requireStoredCredentialId(credential,principal.json().getString("credential_id"));
            NativeSeparationEvidence.restore(frozenWork.wire(),principal,frozenWork.values.snapshot(),credential);
        }catch(Exception error){throw invalid();}
        finally{if(clear!=null)Arrays.fill(clear,(byte)0);VaultValidation.wipe(credential);if(characters!=null&&characters.hasArray())Arrays.fill(characters.array(),'\0');}
    }
    /** CLOSED local saved-record codec. No filesystem adapter, store mount,
     * plaintext/ciphertext getter, stream callback or dispatch is added here.
     * Future fixed native storage receives this opaque type, not WebView JSON.
     * Saved bytes/IVs are recovered unchanged; recovery NEVER encrypts or signs.
     */
    static final class SavedLocalRecord implements AutoCloseable {
        static final String SCHEMA="custodial.native-private-eight-capsule-local-record.v1";
        static final int MAX_BYTES=NativeRetainedNamespaceValues.MAX_BYTES+
            (1+(NativeRetainedNamespaceValues.MAX_BYTES-1)/NativeRetainedNamespaceCustodyLayout.CHUNK_BYTES)*256+8192;
        private byte[] encoded;private final String sha256;
        private SavedLocalRecord(byte[] owned)throws VaultFailure{encoded=owned;sha256=hash(owned);requireOpen();}
        /** Fixed native reader seam ONLY, encrypted local record input; no
         * arbitrary operation/key/path/auth replacement and no byte output. */
        static SavedLocalRecord fromStoredEncryptedRecord(byte[] saved)throws VaultFailure {
            if(saved==null||saved.length<64||saved.length>MAX_BYTES)throw invalid();byte[] own=saved.clone();
            try{return new SavedLocalRecord(own);}catch(VaultFailure e){Arrays.fill(own,(byte)0);throw e;}
        }
        synchronized JSONObject metadata()throws VaultFailure{
            requireOpen();try{return new JSONObject().put("schema",SCHEMA).put("state","OPAQUE_LOCAL_RECORD_NOT_DURABLE_STORAGE_OR_AUTHORITY")
                .put("record_bytes",encoded.length).put("record_sha256",sha256).put("durably_stored",false).put("current_server_readback",false)
                .put("work_accepted",false).put("resend_allowed",false).put("key_removal",false).put("finalizer_allowed",false);}
            catch(Exception e){throw invalid();}
        }
        /** Only the fixed native target can consume private encrypted bytes;
         * no caller-selected path/stream or getter is exposed. */
        synchronized void writeToFixedNativeTarget(NativePrivateCapsuleFileStore.Target target)throws VaultFailure {
            requireOpen();if(target==null)throw invalid();target.writeOriginalEncryptedRecord(encoded,sha256);requireOpen();
        }
        /** Closed owning frame target only. It has a private constructor and
         * cannot expose bytes, supply a path/callback, dispatch or write data.
         * Original encrypted bytes are copied without replacement IVs. */
        synchronized void writeToFixedPrivateCustodyFrameTarget(VaultEngine.NativePrivateCustodyTransportFrame.Target target)throws VaultFailure {
            requireOpen();if(target==null)throw invalid();target.acceptOriginalEncryptedRecord(encoded,sha256);requireOpen();
        }
        boolean sameOriginalEncryptedRecord(SavedLocalRecord other)throws VaultFailure {
            return compareOriginalRecords(this,other);
        }
        private static synchronized boolean compareOriginalRecords(SavedLocalRecord first,SavedLocalRecord other)throws VaultFailure {
            // One fixed comparison monitor before either private record lock:
            // opposite-order comparisons cannot acquire inverse lock order.
            synchronized(first){first.requireOpen();if(other==null)return false;if(other==first)return true;
                synchronized(other){other.requireOpen();return MessageDigest.isEqual(first.encoded,other.encoded);}}
        }
        private void requireOpen()throws VaultFailure {
            if(encoded==null||encoded.length<64||encoded.length>MAX_BYTES||!sha256.equals(hash(encoded)))throw invalid();
            MessageDigest d;try{d=MessageDigest.getInstance("SHA-256");}catch(Exception e){throw invalid();}
            d.update(encoded,0,encoded.length-32);byte[] actual=d.digest();int difference=0;
            for(int i=0;i<32;i++)difference|=actual[i]^encoded[encoded.length-32+i];Arrays.fill(actual,(byte)0);if(difference!=0)throw invalid();
        }
        @Override public synchronized void close(){if(encoded!=null)Arrays.fill(encoded,(byte)0);encoded=null;}
        // Own volatile copy only, never deletion/secure-erasure of saved store.
    }
    /** Opaque saved-record production; only encrypted chunks and bound,
     * non-secret metadata are framed. Private original raw bytes are not used. */
    synchronized SavedLocalRecord savedLocalRecord()throws VaultFailure {
        byte[] payload=null,encoded=null;
        try {
            metadata();ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);
            out.writeInt(0x4d5a4331);text(out,SavedLocalRecord.SCHEMA);text(out,SCHEMA);out.writeInt(binding.length);out.write(binding);
            text(out,capsuleSha256);out.writeInt(chunks.size());
            for(Chunk chunk:chunks){out.writeInt(chunk.index);out.writeInt(chunk.offset);out.writeInt(chunk.length);text(out,chunk.originalSha256);
                out.writeInt(chunk.iv.length);out.write(chunk.iv);out.writeInt(chunk.encrypted.length);out.write(chunk.encrypted);}
            out.flush();payload=bytes.toByteArray();if(payload.length+32>SavedLocalRecord.MAX_BYTES)throw invalid();
            encoded=Arrays.copyOf(payload,payload.length+32);byte[] checksum=MessageDigest.getInstance("SHA-256").digest(payload);
            System.arraycopy(checksum,0,encoded,payload.length,32);Arrays.fill(checksum,(byte)0);
            SavedLocalRecord result=new SavedLocalRecord(encoded);encoded=null;return result;
        }catch(Exception e){throw invalid();}finally{if(payload!=null)Arrays.fill(payload,(byte)0);if(encoded!=null)Arrays.fill(encoded,(byte)0);}
    }
    /** Recovery from a fixed-reader record under the CURRENT typed original
     * layout/value owner and existing key. Same immutable IV/ciphertext/capsule
     * digest, no new nonce/operation/HMAC. Caller must first verify the exact
     * loaded original vault key/WORK witness through the fixed Android adapter.
     * Any unknown/partial/foreign record is refused, not repaired or discarded.
     */
    static NativeRetainedNamespacePrivateCapsule restoreSavedLocalRecord(NativeRetainedNamespaceValues values,byte[] original,
        NativeRetainedNamespaceCustodyLayout.Observation layout,SavedLocalRecord record,SecretKey existingKey)throws VaultFailure {
        if(record==null)throw invalid();synchronized(record){
            List<Chunk> chunks=new ArrayList<>();byte[] capturedBinding=null,expectedBinding=null;NativeRetainedNamespacePrivateCapsule result=null;
            try {
                long started=System.nanoTime();record.requireOpen();requireKey(existingKey);requireValues(values,original,layout);
                java.io.DataInputStream in=new java.io.DataInputStream(new java.io.ByteArrayInputStream(record.encoded,0,record.encoded.length-32));
                if(in.readInt()!=0x4d5a4331||!SavedLocalRecord.SCHEMA.equals(readText(in,128))||!SCHEMA.equals(readText(in,128)))throw invalid();
                int size=in.readInt();if(size<1||size>4096||size>in.available())throw invalid();capturedBinding=new byte[size];in.readFully(capturedBinding);
                expectedBinding=binding(layout);if(!MessageDigest.isEqual(expectedBinding,capturedBinding))throw invalid();
                String savedCapsuleSha=readText(in,64);if(!savedCapsuleSha.matches("[a-f0-9]{64}"))throw invalid();
                int count=in.readInt();if(count!=layout.chunkCount||count<1||count>1+(NativeRetainedNamespaceValues.MAX_BYTES-1)/NativeRetainedNamespaceCustodyLayout.CHUNK_BYTES)throw invalid();
                int offset=0;
                for(int i=0;i<count;i++){
                    requireTime(started);int index=in.readInt(),start=in.readInt(),length=in.readInt(),expected=Math.min(NativeRetainedNamespaceCustodyLayout.CHUNK_BYTES,original.length-offset);
                    String digest=readText(in,64);if(index!=i||start!=offset||length!=expected||length<1||!digest.equals(hash(original,offset,length)))throw invalid();
                    byte[] iv=null,encrypted=null;
                    try {
                        if(in.readInt()!=12)throw invalid();iv=new byte[12];in.readFully(iv);
                        if(in.readInt()!=length+16||length+16>in.available())throw invalid();encrypted=new byte[length+16];in.readFully(encrypted);
                        for(Chunk prior:chunks)if(MessageDigest.isEqual(prior.iv,iv))throw invalid();
                        chunks.add(new Chunk(i,offset,length,digest,iv,encrypted));iv=null;encrypted=null;
                    }finally{if(iv!=null)Arrays.fill(iv,(byte)0);if(encrypted!=null)Arrays.fill(encrypted,(byte)0);}
                    offset+=length;
                }
                if(offset!=original.length||in.available()!=0)throw invalid();result=new NativeRetainedNamespacePrivateCapsule(layout,chunks,capturedBinding);capturedBinding=null;
                if(!savedCapsuleSha.equals(result.capsuleSha256))throw invalid();result.verify(values,original,layout,existingKey);
                record.requireOpen();requireValues(values,original,layout);requireTime(started);return result;
            }catch(Exception e){if(result!=null)result.close();else for(Chunk chunk:chunks)chunk.close();throw invalid();}
            finally{if(capturedBinding!=null)Arrays.fill(capturedBinding,(byte)0);if(expectedBinding!=null)Arrays.fill(expectedBinding,(byte)0);}
        }
    }
    private static String readText(java.io.DataInputStream in,int maximum)throws Exception {
        int n=in.readInt();if(n<1||n>maximum||n*2>in.available())throw invalid();char[] chars=new char[n];
        try{for(int i=0;i<n;i++)chars[i]=in.readChar();return new String(chars);}finally{Arrays.fill(chars,'\0');}
    }
    private static final class Chunk {
        final int index,offset,length;final String originalSha256;
        final byte[] iv,encrypted;
        Chunk(int index,int offset,int length,String originalSha256,byte[] iv,byte[] encrypted){
            this.index=index;this.offset=offset;this.length=length;this.originalSha256=originalSha256;this.iv=iv;this.encrypted=encrypted;
        }
        void close(){Arrays.fill(iv,(byte)0);Arrays.fill(encrypted,(byte)0);}
    }
    private final NativeRetainedNamespaceCustodyLayout.Observation layout;
    private final List<Chunk> chunks;
    private final byte[] binding;
    private final String bindingSha256,capsuleSha256;
    private boolean closed;
    private NativeRetainedNamespacePrivateCapsule(NativeRetainedNamespaceCustodyLayout.Observation layout,List<Chunk> chunks,byte[] binding)throws Exception {
        this.layout=layout;this.chunks=chunks;this.binding=binding;
        bindingSha256=hash(binding);capsuleSha256=manifestHash();
    }
    /** Internal typed call from the fixed Android adapter; never a plugin or
     * caller-supplied cipher/key hook. No new key is generated by this class. */
    static NativeRetainedNamespacePrivateCapsule prepare(NativeRetainedNamespaceValues values,byte[] original,
        NativeRetainedNamespaceCustodyLayout.Observation layout,SecretKey existingKey)throws VaultFailure {
        List<Chunk> chunks=new ArrayList<>();byte[] binding=null;NativeRetainedNamespacePrivateCapsule result=null;
        try {
            long started=System.nanoTime();requireKey(existingKey);requireValues(values,original,layout);
            binding=binding(layout);JSONArray plan=layout.json().getJSONArray("chunks");int offset=0;
            for(int i=0;i<plan.length();i++){
                requireTime(started);JSONObject p=plan.getJSONObject(i);int length=Math.min(NativeRetainedNamespaceCustodyLayout.CHUNK_BYTES,original.length-offset);
                String digest=hash(original,offset,length);
                if(i!=integer(p,"chunk_index")||offset!=integer(p,"byte_offset")||length!=integer(p,"chunk_bytes")
                    ||!digest.equals(string(p,"chunk_sha256")))throw invalid();
                byte[] aad=aad(binding,i,offset,length,digest),encrypted=null,iv=null;
                try {
                    Cipher cipher=Cipher.getInstance(TRANSFORMATION);cipher.init(Cipher.ENCRYPT_MODE,existingKey);cipher.updateAAD(aad);
                    encrypted=cipher.doFinal(original,offset,length);iv=cipher.getIV();
                    if(iv==null||iv.length!=12||encrypted.length!=length+16)throw invalid();
                    for(Chunk prior:chunks)if(MessageDigest.isEqual(prior.iv,iv))throw invalid();
                    chunks.add(new Chunk(i,offset,length,digest,iv,encrypted));iv=null;encrypted=null;
                }finally{Arrays.fill(aad,(byte)0);if(iv!=null)Arrays.fill(iv,(byte)0);if(encrypted!=null)Arrays.fill(encrypted,(byte)0);}
                offset+=length;
            }
            if(offset!=original.length||chunks.size()!=layout.chunkCount)throw invalid();
            requireValues(values,original,layout);result=new NativeRetainedNamespacePrivateCapsule(layout,chunks,binding);binding=null;
            result.verify(values,original,layout,existingKey);requireTime(started);return result;
        }catch(Exception error){
            if(result!=null)result.close();else for(Chunk chunk:chunks)chunk.close();
            if(binding!=null)Arrays.fill(binding,(byte)0);throw invalid();
        }
    }
    /** Rechecks current private bytes, original layout and SAME-key decrypt;
     * authenticated plaintext is compared/wiped internally, never returned. */
    synchronized void verify(NativeRetainedNamespaceValues values,byte[] original,
        NativeRetainedNamespaceCustodyLayout.Observation current,SecretKey existingKey)throws VaultFailure {
        byte[] currentBinding=null;
        try {
            long started=System.nanoTime();if(closed||current!=layout)throw invalid();requireKey(existingKey);requireValues(values,original,current);
            currentBinding=binding(current);
            if(!MessageDigest.isEqual(binding,currentBinding)||!bindingSha256.equals(hash(binding))||!capsuleSha256.equals(manifestHash()))throw invalid();
            MessageDigest recovered=MessageDigest.getInstance("SHA-256");int offset=0;
            for(int i=0;i<chunks.size();i++){
                requireTime(started);Chunk chunk=chunks.get(i);int length=Math.min(NativeRetainedNamespaceCustodyLayout.CHUNK_BYTES,original.length-offset);
                if(chunk.index!=i||chunk.offset!=offset||chunk.length!=length||chunk.iv.length!=12||chunk.encrypted.length!=length+16
                    ||!chunk.originalSha256.equals(hash(original,offset,length)))throw invalid();
                byte[] aad=aad(binding,i,offset,length,chunk.originalSha256),clear=null;
                try {
                    Cipher cipher=Cipher.getInstance(TRANSFORMATION);cipher.init(Cipher.DECRYPT_MODE,existingKey,new GCMParameterSpec(128,chunk.iv));
                    cipher.updateAAD(aad);clear=cipher.doFinal(chunk.encrypted);if(clear.length!=length)throw invalid();
                    int difference=0;for(int j=0;j<length;j++)difference|=clear[j]^original[offset+j];if(difference!=0)throw invalid();recovered.update(clear);
                }finally{Arrays.fill(aad,(byte)0);if(clear!=null)Arrays.fill(clear,(byte)0);}
                offset+=length;
            }
            if(offset!=original.length||chunks.size()!=layout.chunkCount||!values.valuesSha256.equals(hex(recovered.digest())))throw invalid();
            requireValues(values,original,current);requireTime(started);
        }catch(Exception error){throw invalid();}finally{if(currentBinding!=null)Arrays.fill(currentBinding,(byte)0);}
    }
    /** Metadata ONLY. Owning engine MUST recheck actor/readers/current key and
     * round-trip before giving this fresh projection to its internal caller. */
    synchronized JSONObject metadata()throws VaultFailure {
        try {
            if(closed||!bindingSha256.equals(hash(binding))||!capsuleSha256.equals(manifestHash()))throw invalid();
            JSONObject source=layout.json();JSONArray pieces=new JSONArray();
            for(Chunk chunk:chunks)pieces.put(new JSONObject().put("chunk_index",chunk.index).put("byte_offset",chunk.offset)
                .put("cleartext_bytes",chunk.length).put("encrypted_bytes",chunk.encrypted.length).put("chunk_sha256",chunk.originalSha256)
                .put("iv_sha256",hash(chunk.iv)).put("encrypted_sha256",hash(chunk.encrypted)));
            JSONObject p=new JSONObject().put("schema",SCHEMA).put("state","VOLATILE_SAME_DEVICE_EXISTING_KEY_CAPSULE_NOT_DURABLE_CUSTODY")
                .put("values_schema",NativeRetainedNamespaceValues.SCHEMA).put("source_capture_sha256",layout.sourceCaptureSha256)
                .put("values_sha256",layout.valuesSha256).put("semantic_join_sha256",layout.semanticJoinSha256).put("layout_sha256",layout.layoutSha256)
                .put("capsule_sha256",capsuleSha256).put("aad_binding_sha256",bindingSha256).put("aad_domain",AAD_DOMAIN)
                .put("cipher_suite","AES-GCM_EXISTING_DEVICE_KEY_SIZE_UNVERIFIED").put("gcm_tag_bits",128).put("iv_bytes",12)
                .put("existing_device_key_alias",AndroidKeystoreCipher.KEY_ALIAS).put("key_family_references",source.getJSONArray("key_family_references"))
                .put("original_generation_id",source.get("original_generation_id")).put("principal_digest",source.get("principal_digest"))
                .put("engine_revision",source.get("engine_revision")).put("original_frozen_work_sha256",source.get("original_frozen_work_sha256"))
                .put("byte_count",layout.byteCount).put("record_count",layout.recordCount).put("chunk_count",chunks.size()).put("chunks",pieces)
                .put("local_same_key_exact_roundtrip_checked",true).put("all_original_key_families_must_survive",true)
                .put("same_device_key_survival_required",true).put("work_witnesses_do_not_cover_all8_values",true)
                .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN")
                .put("new_custody_operation_id",JSONObject.NULL).put("writer_path",JSONObject.NULL);
            for(String flag:new String[]{"raw_transport_allowed","transport_allowed","body_prepared","durable_retention",
                "all8_typed_backend_contract_bound","actual_Android_keystore_qualified","key_loss_recovery","cross_device_recovery",
                "complete_application_recovery","complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","current_server_readback",
                "inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","absence_proves_no_late_commit",
                "finalizer_allowed","key_removal","phone_released"})p.put(flag,false);
            return p;
        }catch(Exception error){throw invalid();}
    }
    @Override public synchronized void close(){if(closed)return;closed=true;for(Chunk chunk:chunks)chunk.close();Arrays.fill(binding,(byte)0);}
    // Logical buffer disposal only. No secure-erasure claim, original-store
    // cleanup, key deletion or closing of someone else's owning observations.
    private String manifestHash()throws Exception {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");digest.update(binding);
        for(Chunk chunk:chunks){digest.update(aad(binding,chunk.index,chunk.offset,chunk.length,chunk.originalSha256));digest.update(chunk.iv);digest.update(chunk.encrypted);}
        return hex(digest.digest());
    }
    private static byte[] binding(NativeRetainedNamespaceCustodyLayout.Observation layout)throws Exception {
        JSONObject p=layout.json();
        if(!NativeRetainedNamespaceCustodyLayout.SCHEMA.equals(string(p,"schema"))||!NativeRetainedNamespaceValues.SCHEMA.equals(string(p,"values_schema"))
            ||!layout.layoutSha256.equals(string(p,"layout_sha256"))||!layout.valuesSha256.equals(string(p,"values_sha256"))
            ||!layout.sourceCaptureSha256.equals(string(p,"source_capture_sha256"))||!layout.semanticJoinSha256.equals(string(p,"semantic_join_sha256"))
            ||layout.byteCount!=integer(p,"byte_count")||layout.recordCount!=integer(p,"record_count")||layout.chunkCount!=integer(p,"chunk_count"))throw invalid();
        for(String flag:new String[]{"raw_transport_allowed","transport_allowed","body_prepared","all8_typed_backend_contract_bound",
            "durable_retention","current_server_readback","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})
            if(!Boolean.FALSE.equals(p.get(flag)))throw invalid();
        if(!JSONObject.NULL.equals(p.get("new_custody_operation_id"))||!JSONObject.NULL.equals(p.get("writer_path")))throw invalid();
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream frame=new DataOutputStream(bytes);
        for(String value:new String[]{AAD_DOMAIN,SCHEMA,NativeRetainedNamespaceValues.SCHEMA,AndroidKeystoreCipher.KEY_ALIAS,
            layout.sourceCaptureSha256,layout.valuesSha256,layout.semanticJoinSha256,layout.layoutSha256,
            string(p,"principal_digest"),string(p,"original_generation_id"),string(p,"original_frozen_work_sha256")})text(frame,value);
        frame.writeLong(integer(p,"engine_revision"));frame.writeInt(layout.byteCount);frame.writeInt(layout.recordCount);frame.writeInt(layout.chunkCount);
        JSONArray families=p.getJSONArray("key_family_references");if(families.length()!=4)throw invalid();
        java.util.Set<String> expected=new java.util.TreeSet<>(NativeProtectedNamespaceObservation.KEY_FAMILIES.values()),seen=new java.util.HashSet<>();long rows=0;
        for(int i=0;i<families.length();i++){
            JSONObject family=families.getJSONObject(i);String name=string(family,"key_family");long count=integer(family,"source_declared_raw_rows_to_preserve");
            if(!expected.contains(name)||!seen.add(name)||count<0||count>32768||!"UNKNOWN".equals(string(family,"possible_undeclared_references"))
                ||!Boolean.TRUE.equals(family.get("zero_rows_is_not_key_removal_authority")))throw invalid();
            for(String flag:new String[]{"all_writer_durable_freeze_or_ABA_guard","current_server_reconciliation","finalizer_allowed","key_removal"})
                if(!Boolean.FALSE.equals(family.get(flag)))throw invalid();
            text(frame,name);frame.writeLong(count);rows+=count;
        }
        if(!seen.equals(expected)||rows!=layout.recordCount)throw invalid();frame.flush();return bytes.toByteArray();
    }
    private static byte[] aad(byte[] binding,int index,int offset,int length,String digest)throws Exception {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream frame=new DataOutputStream(bytes);
        frame.writeInt(binding.length);frame.write(binding);frame.writeInt(index);frame.writeInt(offset);frame.writeInt(length);text(frame,digest);frame.flush();return bytes.toByteArray();
    }
    private static void text(DataOutputStream frame,String value)throws Exception{frame.writeInt(value.length());for(int i=0;i<value.length();i++)frame.writeChar(value.charAt(i));}
    private static String string(JSONObject p,String name)throws Exception{Object v=p.get(name);if(!(v instanceof String))throw invalid();return (String)v;}
    private static long integer(JSONObject p,String name)throws Exception{Object v=p.get(name);if(!(v instanceof Integer||v instanceof Long))throw invalid();return ((Number)v).longValue();}
    private static void requireKey(SecretKey key)throws VaultFailure{if(key==null||!"AES".equals(key.getAlgorithm()))throw invalid();}
    private static void requireValues(NativeRetainedNamespaceValues values,byte[] original,NativeRetainedNamespaceCustodyLayout.Observation layout)throws VaultFailure {
        if(values==null||original==null||layout==null)throw invalid();values.requireCustodyLayoutAndOriginalValues(original,layout);
    }
    private static String hash(byte[] bytes)throws VaultFailure{return hash(bytes,0,bytes.length);}
    private static String hash(byte[] bytes,int offset,int length)throws VaultFailure{try{MessageDigest d=MessageDigest.getInstance("SHA-256");d.update(bytes,offset,length);return hex(d.digest());}catch(Exception e){throw invalid();}}
    private static String hex(byte[] bytes){StringBuilder s=new StringBuilder(64);for(byte b:bytes){s.append(Character.forDigit((b&255)>>>4,16)).append(Character.forDigit(b&15,16));}return s.toString();}
    private static void requireTime(long started)throws VaultFailure{if(System.nanoTime()-started>30_000_000_000L)throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
