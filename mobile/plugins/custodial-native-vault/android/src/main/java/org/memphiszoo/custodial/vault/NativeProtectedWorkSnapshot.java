package org.memphiszoo.custodial.vault;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** Lossless identity of an exact native private-preferences snapshot. This is
 * not a semantic inventory, an empty-queue claim or automatic cutoff proof.
 * Original ciphertext stays in its original namespace. Unrecognized records
 * are included, not ignored. Browser inventory always remains UNKNOWN here.
 * No mounted WebView route can supply or sign this value.
 */
final class NativeProtectedWorkSnapshot {
    static final String SCHEMA="custodial.native-protected-work-snapshot.v1";
    static final String FAILURE="custodial_native_protected_snapshot_invalid";
    private static final String FENCE_KEY="native_separation_freeze.v1";
    private static final String PROBE_KEY="native_separation_probe.v1";
    private final String records;
    private final List<RecordRow> detachedRows;
    final String digest;
    final int recordCount;

    private NativeProtectedWorkSnapshot(String records,List<RecordRow> rows,int count)throws VaultFailure{
        this.records=records;detachedRows=Collections.unmodifiableList(new ArrayList<>(rows));recordCount=count;
        digest=NativeProviderPrincipal.hash(new JSONArray().put(SCHEMA).put(records).toString());
    }

    static NativeProtectedWorkSnapshot capture(Map<String,?> source)throws VaultFailure{
        try{
            if(source==null||source.size()>4096)throw invalid();
            JSONArray rows=new JSONArray();ArrayList<RecordRow> detached=new ArrayList<>();long totalCharacters=0,recurringViewCharacters=0;
            int recurringViewCount=0,ordinaryMetadataCharacters=2,viewMetadataCharacters=2;
            for(String key:new TreeSet<>(source.keySet())){
                if(key==null||key.isEmpty()||key.length()>1024||key.equals(FENCE_KEY)||key.equals(PROBE_KEY))throw invalid();
                Object value=source.get(key);boolean recurringView=recurringViewKey(key);
                if(recurringView&&(!(value instanceof String)||++recurringViewCount>256))throw invalid();
                long cellCharacters=key.length();String type;MessageDigest hash=MessageDigest.getInstance("SHA-256");
                // Hash raw UTF-16 code units, not replacement-decoded UTF-8:
                // even corrupt/unpaired surrogate bytes must remain distinct.
                if(value instanceof String){type="string";String text=(String)value;
                    int cellLimit=retainedStringLimit(key);
                    if(text.length()>cellLimit)throw invalid();cellCharacters+=text.length();string(hash,text);
                }else if(value instanceof Integer){type="int32";string(hash,value.toString());
                }else if(value instanceof Long){type="int64";string(hash,value.toString());
                }else if(value instanceof Boolean){type="boolean";hash.update((byte)((Boolean)value?1:0));
                }else if(value instanceof Float){type="float32";string(hash,Integer.toUnsignedString(Float.floatToRawIntBits((Float)value),16));
                }else if(value instanceof Set<?>){type="string-set";ArrayList<String> strings=new ArrayList<>();
                    if(((Set<?>)value).size()>4096)throw invalid();
                    for(Object item:(Set<?>)value){if(!(item instanceof String)||((String)item).length()>524288)throw invalid();strings.add((String)item);cellCharacters+=((String)item).length();}
                    Collections.sort(strings);for(String item:strings)string(hash,item);
                }else throw invalid(); // Unknown type is UNKNOWN, never silently absent.
                if(recurringView){recurringViewCharacters+=cellCharacters;if(recurringViewCharacters>32L*1024*1024)throw invalid();}
                else {totalCharacters+=cellCharacters;if(totalCharacters>8388608)throw invalid();}
                // Hex key units preserve even malformed Unicode and avoid any
                // platform JSON serializer normalization of an original key.
                RecordRow row=new RecordRow(hexKey(key),type,hex(hash.digest()));detached.add(row);rows.put(row.json());
                // Extend only the separately bounded recurring-view family.
                // Ordinary raw cells/8MiB totals/metadata budget stay exact.
                int metadata=row.json().toString().length()+1;
                if(recurringView){viewMetadataCharacters+=metadata;if(viewMetadataCharacters>196608)throw invalid();}
                else {ordinaryMetadataCharacters+=metadata;if(ordinaryMetadataCharacters>196609)throw invalid();}
                if(rows.length()>4096)throw invalid();
            }
            String encoded=rows.toString();if(encoded.length()>196608+(recurringViewCount==0?0:196608))throw invalid();
            return new NativeProtectedWorkSnapshot(encoded,detached,rows.length());
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }

    // Same purpose-specific raw ciphertext bound for WORK-only and all-store
    // capture. Other namespaces cannot borrow the receipt name to widen a cell.
    private static boolean recurringViewKey(String key){return key!=null&&key.matches("native_recurring_view_chunk_sha256:[a-f0-9]{64}");}
    static int retainedStringLimit(String key){
        if(recurringViewKey(key))return 131072;
        return key!=null&&key.matches("authenticated_completion_receipt_sha256:[a-f0-9]{64}")?4*1024*1024:524288;
    }

    static boolean exactRawEquals(Map<String,?> first,Map<String,?> second)throws VaultFailure{
        if(first==null||second==null||first.size()!=second.size()||!first.keySet().equals(second.keySet()))return false;
        try{
            for(String key:first.keySet()){
                if(key==null)return false;
                Object a=first.get(key),b=second.get(key);
                if(FENCE_KEY.equals(key)||PROBE_KEY.equals(key)){
                    if(!(a instanceof String)||!(b instanceof String)||!a.equals(b))return false;
                }else if(!exactValueEquals(a,b))return false;
            }
            return true;
        }catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }
    private static boolean exactValueEquals(Object a,Object b)throws VaultFailure{
        if(a instanceof String)return b instanceof String&&a.equals(b);
        if(a instanceof Integer)return b instanceof Integer&&a.equals(b);
        if(a instanceof Long)return b instanceof Long&&a.equals(b);
        if(a instanceof Boolean)return b instanceof Boolean&&a.equals(b);
        if(a instanceof Float)return b instanceof Float
            &&Float.floatToRawIntBits((Float)a)==Float.floatToRawIntBits((Float)b);
        if(a instanceof Set<?> && b instanceof Set<?>){
            Set<?> x=(Set<?>)a,y=(Set<?>)b;if(x.size()!=y.size())return false;
            TreeSet<String> xs=new TreeSet<>(),ys=new TreeSet<>();
            for(Object item:x){if(!(item instanceof String))return false;xs.add((String)item);}
            for(Object item:y){if(!(item instanceof String))return false;ys.add((String)item);}
            return xs.equals(ys);
        }
        return false;
    }

    JSONArray recordRows()throws VaultFailure{
        try{return materializeRows();}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }

    JSONObject manifest(NativeSeparationContext context)throws VaultFailure{
        try{
            if(context==null)throw invalid();
            return new JSONObject().put("schema",SCHEMA).put("separation_context",context.json())
                .put("original_principal",context.originalPrincipal()).put("raw_snapshot_sha256",digest)
                .put("record_count",recordCount).put("records",materializeRows())
                .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN")
                .put("new_work_allowed",false).put("phone_released",false);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }
    private JSONArray materializeRows()throws Exception{
        JSONArray rows=new JSONArray();for(RecordRow row:detachedRows)rows.put(row.json());return rows;
    }
    private static final class RecordRow{
        private final String key,type,digest;
        private RecordRow(String key,String type,String digest){this.key=key;this.type=type;this.digest=digest;}
        private JSONArray json(){return new JSONArray().put(key).put(type).put(digest);}
    }
    private static void string(MessageDigest hash,String value){
        int length=value.length();for(int shift=24;shift>=0;shift-=8)hash.update((byte)(length>>>shift));
        for(int i=0;i<length;i++){char c=value.charAt(i);hash.update((byte)(c>>>8));hash.update((byte)c);}
    }
    private static String hexKey(String key){
        StringBuilder out=new StringBuilder(key.length()*4);
        for(int i=0;i<key.length();i++)for(int shift=12;shift>=0;shift-=4)out.append(Character.forDigit((key.charAt(i)>>>shift)&15,16));
        return out.toString();
    }
    private static String hex(byte[] value){StringBuilder out=new StringBuilder(value.length*2);for(byte b:value)out.append(Character.forDigit((b&255)>>>4,16)).append(Character.forDigit(b&15,16));return out.toString();}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
