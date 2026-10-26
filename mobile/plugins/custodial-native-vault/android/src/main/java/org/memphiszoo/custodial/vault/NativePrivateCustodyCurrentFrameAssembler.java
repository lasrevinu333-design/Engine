package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONObject;

/** Owned opaque encrypted-byte assembly only. Engine-minted current pins are
 * required; this performs no parsing, GCM, query, journal or authority effect. */
final class NativePrivateCustodyCurrentFrameAssembler implements AutoCloseable {
    private final VaultEngine.NativePrivateCustodyCurrentFramePins pins;
    private byte[] frame;
    private boolean[] received;
    private Chunk[] chunks;
    private int count,bytes,accepted;
    private String digest;
    private boolean closed;

    private static final class Chunk {
        final int offset,length;final String digest;
        Chunk(int offset,int length,String digest){this.offset=offset;this.length=length;this.digest=digest;}
    }

    NativePrivateCustodyCurrentFrameAssembler(VaultEngine.NativePrivateCustodyCurrentFramePins pins)throws VaultFailure {
        this.pins=pins;boolean success=false;
        try {
            if(pins==null)throw failure();
            JSONObject snapshot=pins.metadataForAssembly();
            if(snapshot==null||snapshot.length()!=4)throw failure();
            bytes=boundedInteger(snapshot,"frame_bytes",VaultEngine.NativePrivateCustodyTransportFrame.MAX_BYTES);
            count=boundedInteger(snapshot,"chunk_count",VaultEngine.NativePrivateCustodyChunkIdentityPlan.MAX_CHUNKS);
            digest=hash(snapshot,"frame_sha256");
            if(bytes<1||bytes>VaultEngine.NativePrivateCustodyTransportFrame.MAX_BYTES
                ||count<1||count>VaultEngine.NativePrivateCustodyChunkIdentityPlan.MAX_CHUNKS
                ||count!=(bytes+VaultEngine.NativePrivateCustodyChunkIdentityPlan.CHUNK_BYTES-1)/VaultEngine.NativePrivateCustodyChunkIdentityPlan.CHUNK_BYTES
                ||digest==null||!digest.matches("[0-9a-f]{64}"))throw failure();
            Object value=snapshot.get("chunks");
            if(!(value instanceof JSONArray)||((JSONArray)value).length()!=count)throw failure();
            JSONArray rows=(JSONArray)value;chunks=new Chunk[count];
            for(int index=0;index<count;index++){
                Object item=rows.get(index);if(!(item instanceof JSONObject))throw failure();
                JSONObject row=(JSONObject)item;if(row.length()!=4)throw failure();
                int offset=index*VaultEngine.NativePrivateCustodyChunkIdentityPlan.CHUNK_BYTES;
                int length=Math.min(VaultEngine.NativePrivateCustodyChunkIdentityPlan.CHUNK_BYTES,bytes-offset);
                exactInteger(row,"chunk_index",index);exactInteger(row,"offset",offset);exactInteger(row,"chunk_bytes",length);
                if(length<1)throw failure();chunks[index]=new Chunk(offset,length,hash(row,"chunk_sha256"));
            }
            frame=new byte[bytes];received=new boolean[count];pins.requireCurrent();success=true;
        }catch(Exception e){throw failure();}finally{if(!success)close();}
    }

    private static VaultFailure failure(){return new VaultFailure(NativeRetainedAttempt.FAILURE);}
    /** Structure only, never currentness authority. Accept and transfer below
     * perform only private, tentative array/hash work before their terminal
     * full pin validation. A failed terminal check closes and wipes it all. */
    private void requireOpenStructure()throws VaultFailure {
        if(closed||frame==null||received==null||chunks==null)throw failure();
    }
    // Detached immutable scalars only; never cache or obtain a currentness verdict here.
    private Chunk metadata(int index){return chunks[index];}
    private static int boundedInteger(JSONObject row,String key,int maximum)throws Exception {
        Object value=row.get(key);
        if(!(value instanceof Integer||value instanceof Long))throw failure();
        long number=((Number)value).longValue();if(number<1||number>maximum)throw failure();return (int)number;
    }
    private static String hash(JSONObject row,String key)throws Exception {
        Object value=row.get(key);
        if(!(value instanceof String)||!((String)value).matches("[0-9a-f]{64}"))throw failure();return (String)value;
    }
    private static void exactInteger(JSONObject row,String key,int expected)throws Exception {
        Object value=row.get(key);
        if(!(value instanceof Integer||value instanceof Long)||((Number)value).longValue()!=expected)throw failure();
    }

    synchronized void accept(int originalIndex,byte[] alreadyVerifiedEncryptedPiece)throws VaultFailure {
        byte[] owned=null;boolean success=false;
        try {
            requireOpenStructure();
            if(originalIndex<0||originalIndex>=count||received[originalIndex]||alreadyVerifiedEncryptedPiece==null)throw failure();
            Chunk row=metadata(originalIndex);
            if(alreadyVerifiedEncryptedPiece.length!=row.length)throw failure();
            owned=alreadyVerifiedEncryptedPiece.clone();
            if(!row.digest.equals(NativeRetainedAttempt.hash(owned)))throw failure();
            System.arraycopy(owned,0,frame,row.offset,owned.length);
            received[originalIndex]=true;accepted++;pins.requireCurrent();success=true;
        }catch(Exception e){throw failure();}finally{if(owned!=null)Arrays.fill(owned,(byte)0);if(!success)close();}
    }

    synchronized byte[] takeCompleteFrame()throws VaultFailure {
        byte[] transferred=null;boolean success=false;
        try {
            requireOpenStructure();if(accepted!=count)throw failure();
            for(boolean present:received)if(!present)throw failure();
            if(!digest.equals(NativeRetainedAttempt.hash(frame)))throw failure();
            transferred=frame;frame=null;close();
            pins.requireCurrent();success=true;return transferred;
        }catch(Exception e){throw failure();}finally{
            if(!success){if(transferred!=null)Arrays.fill(transferred,(byte)0);close();}
        }
    }

    @Override public synchronized void close(){
        // Pure owned-state cleanup, including after authority loss: no key or filesystem IO.
        if(frame!=null)Arrays.fill(frame,(byte)0);frame=null;
        if(received!=null)Arrays.fill(received,false);received=null;closed=true;
        if(chunks!=null)Arrays.fill(chunks,null);chunks=null;
        digest=null;count=0;bytes=0;accepted=0;
    }
}
