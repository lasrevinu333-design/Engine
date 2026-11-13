package org.memphiszoo.custodial.vault;

import java.security.MessageDigest;
import org.json.JSONArray;
import org.json.JSONObject;

/** UNMOUNTED closed native custody layout, NOT a custody request or receipt.
 * It binds fixed bounded chunks of the exact private all8 binary to its local
 * semantic join and original actor/generation. No bytes, raw keys, signatures,
 * URL, caller-selected operation, nonce, writer or generic callback is exposed.
 * Unlike the historical WORK wire, all8 includes unresolved legacy/provider
 * rows which may contain private credentials. Raw transport is REFUSED.
 * A separately reviewed confidentiality/recovery and typed server contract
 * must exist before any durable capsule or request is prepared.
 */
final class NativeRetainedNamespaceCustodyLayout {
    static final String SCHEMA="custodial.native-retained-eight-values-custody-layout.v1";
    static final String FAILURE="custodial_native_all8_custody_layout_unknown";
    static final int CHUNK_BYTES=24576;
    static final class Observation {
        final int byteCount,chunkCount,recordCount;
        final String sourceCaptureSha256,valuesSha256,semanticJoinSha256,layoutSha256;
        final boolean transportAllowed=false,durable=false,currentServerReadback=false,semanticInventoryComplete=false,
            workAccepted=false,inventoryAcknowledged=false,resendAllowed=false,finalizerAllowed=false,keyRemovalAllowed=false;
        private final String encoded;
        private Observation(JSONObject metadata,NativeRetainedNamespaceValues values,NativeRetainedNamespaceSemanticJoin.Observation joined,String digest)throws Exception {
            byteCount=values.byteCount;recordCount=values.recordCount;chunkCount=countForBytes(byteCount);
            sourceCaptureSha256=values.sourceCaptureSha256;valuesSha256=values.valuesSha256;
            semanticJoinSha256=joined.joinSha256;layoutSha256=digest;encoded=metadata.toString();
            if(encoded.length()>2*1024*1024)throw invalid();
        }
        JSONObject json()throws VaultFailure{try{return new JSONObject(encoded);}catch(Exception e){throw invalid();}}
    }
    static int countForBytes(int size)throws VaultFailure {
        if(size<1||size>NativeRetainedNamespaceValues.MAX_BYTES)throw invalid();
        return 1+(size-1)/CHUNK_BYTES;
    }
    /** Only the owning private values class passes its existing buffer here.
     * Binding/re-hashing before and after fails on modified buffers. This is
     * not a generic exporter; output contains byte ranges and digests ONLY. */
    static Observation inspect(NativeRetainedNamespaceValues values,byte[] original,
        NativeRetainedNamespaceSemanticJoin.Observation joined,NativeProviderPrincipal principal,long revision,
        String generation,String frozenWorkDigest)throws VaultFailure {
        try {
            long started=System.nanoTime();
            if(values==null||original==null||joined==null||principal==null||revision<0||generation==null||frozenWorkDigest==null)throw invalid();
            values.requireOpen();int count=countForBytes(original.length);
            if(original.length!=values.byteCount||!NativeRetainedAttempt.hash(original).equals(values.valuesSha256)
                ||joined.recordCount!=values.recordCount||!joined.sourceCaptureSha256.equals(values.sourceCaptureSha256)
                ||!joined.valuesSha256.equals(values.valuesSha256))throw invalid();
            JSONObject j=joined.json();
            if(!NativeRetainedNamespaceSemanticJoin.SCHEMA.equals(string(j,"schema"))
                ||!values.sourceCaptureSha256.equals(string(j,"source_capture_sha256"))
                ||!values.valuesSha256.equals(string(j,"values_sha256"))||!joined.joinSha256.equals(string(j,"semantic_join_sha256"))
                ||!principal.digest.equals(string(j,"principal_digest"))||!generation.equals(string(j,"original_generation_id"))
                ||revision!=integer(j.get("engine_revision"))||!frozenWorkDigest.equals(string(j,"original_frozen_work_sha256"))
                ||values.recordCount!=integer(j.get("record_count"))||!"UNKNOWN".equals(j.get("native_semantic_inventory_state"))
                ||!"UNKNOWN".equals(j.get("browser_inventory_state")))throw invalid();
            for(String flag:new String[]{"durable_retention","all8_backend_writer_bound","complete_namespace_inventory",
                "all_writer_durable_freeze_or_ABA_guard","current_server_readback","inventory_acknowledged","work_accepted",
                "new_work_allowed","resend_allowed","absence_proves_no_late_commit","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(j.get(flag)))throw invalid();
            if(!Boolean.TRUE.equals(j.get("work_witnesses_do_not_cover_all8_values")))throw invalid();
            digest(values.sourceCaptureSha256);digest(values.valuesSha256);digest(joined.joinSha256);digest(frozenWorkDigest);digest(principal.digest);
            if(!generation.matches("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"))throw invalid();
            MessageDigest identity=MessageDigest.getInstance("SHA-256");
            for(String text:new String[]{SCHEMA,NativeRetainedNamespaceValues.SCHEMA,values.sourceCaptureSha256,values.valuesSha256,
                joined.joinSha256,frozenWorkDigest,principal.digest,generation,Long.toString(revision),Integer.toString(values.recordCount),Integer.toString(original.length)})text(identity,text);
            JSONArray chunks=new JSONArray();int offset=0;
            for(int i=0;i<count;i++){
                requireTime(started);int length=Math.min(CHUNK_BYTES,original.length-offset);
                MessageDigest piece=MessageDigest.getInstance("SHA-256");piece.update(original,offset,length);String hash=hex(piece.digest());
                text(identity,Integer.toString(i));text(identity,Integer.toString(offset));text(identity,Integer.toString(length));text(identity,hash);
                chunks.put(new JSONObject().put("chunk_index",i).put("byte_offset",offset).put("chunk_bytes",length).put("chunk_sha256",hash)
                    .put("custody_request_id",JSONObject.NULL).put("encrypted_capsule_sha256",JSONObject.NULL)
                    .put("body_prepared",false).put("durably_stored",false).put("server_readback",false));offset+=length;
            }
            if(offset!=original.length||count!=chunks.length())throw invalid();String layoutDigest=hex(identity.digest());
            JSONObject result=new JSONObject().put("schema",SCHEMA).put("state","EXACT_PRIVATE_ALL8_FIXED_CHUNK_LAYOUT_NOT_CAPSULE_TRANSPORT_OR_CUSTODY")
                .put("values_schema",NativeRetainedNamespaceValues.SCHEMA).put("source_capture_sha256",values.sourceCaptureSha256)
                .put("values_sha256",values.valuesSha256).put("semantic_join_sha256",joined.joinSha256).put("layout_sha256",layoutDigest)
                .put("original_frozen_work_sha256",frozenWorkDigest).put("original_generation_id",generation)
                .put("principal_digest",principal.digest).put("engine_revision",revision).put("record_count",values.recordCount)
                .put("byte_count",original.length).put("chunk_bytes",CHUNK_BYTES).put("chunk_count",count).put("chunks",chunks)
                .put("native_namespaces",j.getJSONArray("namespaces")).put("key_family_references",j.getJSONArray("key_family_references"))
                .put("original_work_witness_join_sha256",joined.joinSha256).put("work_witnesses_do_not_cover_all8_values",true)
                .put("new_custody_operation_id",JSONObject.NULL).put("writer_path",JSONObject.NULL)
                .put("raw_transport_allowed",false).put("transport_allowed",false).put("body_prepared",false)
                .put("confidentiality_contract_verified",false).put("recovery_contract_verified",false)
                .put("unresolved_rows_may_contain_private_credentials",true).put("reviewed_confidentiality_and_recovery_required",true)
                .put("all8_typed_backend_contract_bound",false).put("durable_retention",false)
                .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN");
            for(String flag:new String[]{"complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","current_server_readback",
                "clock_profile_qualified","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed",
                "absence_proves_no_late_commit","finalizer_allowed","key_removal","phone_released"})result.put(flag,false);
            Observation value=new Observation(result,values,joined,layoutDigest);
            values.requireOpen();if(!NativeRetainedAttempt.hash(original).equals(values.valuesSha256))throw invalid();requireTime(started);return value;
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid();}
    }
    private static String string(JSONObject value,String field)throws Exception{Object raw=value.get(field);if(!(raw instanceof String))throw invalid();return (String)raw;}
    private static long integer(Object value)throws VaultFailure{if(!(value instanceof Integer||value instanceof Long))throw invalid();return ((Number)value).longValue();}
    private static void digest(String value)throws VaultFailure{if(value==null||!value.matches("[a-f0-9]{64}"))throw invalid();}
    private static void text(MessageDigest hash,String value){int n=value.length();for(int shift=24;shift>=0;shift-=8)hash.update((byte)(n>>>shift));
        for(int i=0;i<n;i++){char c=value.charAt(i);hash.update((byte)(c>>>8));hash.update((byte)c);}}
    private static String hex(byte[] bytes){StringBuilder value=new StringBuilder(64);for(byte b:bytes){value.append(Character.forDigit((b&255)>>>4,16)).append(Character.forDigit(b&15,16));}return value.toString();}
    private static void requireTime(long started)throws VaultFailure{if(System.nanoTime()-started>30_000_000_000L)throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
