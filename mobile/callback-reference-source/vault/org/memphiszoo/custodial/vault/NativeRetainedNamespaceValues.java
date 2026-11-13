package org.memphiszoo.custodial.vault;

import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/** UNMOUNTED native-only, volatile lossless capture of exactly the existing
 * eight declared stores. This is NOT the existing WORK-only wire schema and
 * must not be sent to that writer. No generic raw getter/callback, decoder,
 * transport, decryption, key retrieval, storage write, semantic ACK or deletion
 * is exposed. Unknown keys, original markers and ciphertext are NOT filtered.
 * The owning observation/engine must recheck original actor and all readers.
 * Equal reads still cannot prove all-writer durable freeze or ABA exclusion.
 */
final class NativeRetainedNamespaceValues implements AutoCloseable {
    static final String SCHEMA="custodial.native-retained-eight-namespace-values.v1";
    static final String FAILURE="custodial_native_retained_namespace_values_unknown";
    static final int MAX_BYTES=40*1024*1024;
    final String sourceCaptureSha256,valuesSha256;
    final int recordCount,byteCount;
    final Map<String,Integer> recordCounts;
    final boolean durable=false,semanticInventoryComplete=false,currentServerReadback=false,
        workAccepted=false,inventoryAcknowledged=false,resendAllowed=false,finalizerAllowed=false,keyRemovalAllowed=false;
    private byte[] encoded;
    // Reuse only the fixed adapter. Every method still looks up the current
    // existing alias and decrypts/verifies the original vault and frozen WORK;
    // no key, credential or successful validation is retained here.
    private final AndroidKeystoreCipher custodyCipher = new AndroidKeystoreCipher();

    private NativeRetainedNamespaceValues(Map<String,Map<String,?>> raw,String identity) throws VaultFailure {
        sourceCaptureSha256=identity;
        encoded=encode(raw,identity);byteCount=encoded.length;valuesSha256=hash(encoded);
        Map<String,Integer> counts=new TreeMap<>();int total=0;
        for(var entry:raw.entrySet()){counts.put(entry.getKey(),entry.getValue().size());total+=entry.getValue().size();}
        recordCounts=Collections.unmodifiableMap(counts);recordCount=total;
    }
    static NativeRetainedNamespaceValues capture(Map<String,Map<String,?>> all,String captureIdentity) throws VaultFailure {
        try {
            if(captureIdentity==null||!captureIdentity.matches("[a-f0-9]{64}"))throw invalid();
            Map<String,Map<String,?>> original=copy(all);
            NativeRetainedNamespaceValues value=new NativeRetainedNamespaceValues(original,captureIdentity);
            try {if(!same(original,all))throw invalid();return value;}
            catch(Exception changed){value.close();throw invalid();}
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    synchronized boolean matchesOriginal(Map<String,Map<String,?>> all,String captureIdentity) throws VaultFailure {
        if(encoded==null)throw invalid();if(!sourceCaptureSha256.equals(captureIdentity))return false;
        byte[] current=null;
        try {current=encode(copy(all),captureIdentity);return MessageDigest.isEqual(encoded,current);}
        catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
        finally {if(current!=null)Arrays.fill(current,(byte)0);}
    }
    /** Typed internal layout only: private original buffer is never returned.
     * This selects no wire/path/operation/nonce and cannot send raw values. */
    synchronized NativeRetainedNamespaceCustodyLayout.Observation inspectCustodyLayout(
        NativeRetainedNamespaceSemanticJoin.Observation joined,NativeProviderPrincipal principal,long revision,
        String generation,String frozenWorkDigest)throws VaultFailure {
        requireOpen();return NativeRetainedNamespaceCustodyLayout.inspect(this,encoded,joined,principal,revision,generation,frozenWorkDigest);
    }
    synchronized void requireCustodyLayoutIdentity(NativeRetainedNamespaceCustodyLayout.Observation layout)throws VaultFailure {
        requireOpen();if(layout==null||layout.byteCount!=byteCount||layout.recordCount!=recordCount
            ||!layout.sourceCaptureSha256.equals(sourceCaptureSha256)||!layout.valuesSha256.equals(valuesSha256)
            ||!hash(encoded).equals(valuesSha256))throw invalid();
    }
    /** Same-call capsule check under the private buffer's owning monitor.
     * Layout validation just hashed encoded: alias identity permits only that
     * duplicate hash to be omitted, never a length check or a later recheck.
     * A different buffer still requires its own independent current digest. */
    synchronized void requireCustodyLayoutAndOriginalValues(byte[] original,
        NativeRetainedNamespaceCustodyLayout.Observation layout)throws VaultFailure {
        requireCustodyLayoutIdentity(layout);
        if(original==null||original.length!=byteCount)throw new VaultFailure(NativeRetainedNamespacePrivateCapsule.FAILURE);
        if(original!=encoded){
            String digest;
            try{digest=hash(original);}catch(VaultFailure unavailable){throw new VaultFailure(NativeRetainedNamespacePrivateCapsule.FAILURE);}
            if(!valuesSha256.equals(digest))throw new VaultFailure(NativeRetainedNamespacePrivateCapsule.FAILURE);
        }
    }
    /** Closed fixed adapter; no caller key/cipher/domain/path or byte getter. */
    synchronized NativeRetainedNamespacePrivateCapsule preparePrivateCapsule(NativeRetainedNamespaceCustodyLayout.Observation layout,
        VaultSnapshot vault,NativeRetainedWorkCapture frozenWork,NativeProviderPrincipal principal)throws VaultFailure {
        requireCustodyLayoutIdentity(layout);return custodyCipher.preparePrivateNamespaceCapsule(this,encoded,layout,vault,frozenWork,principal);
    }
    synchronized void verifyPrivateCapsule(NativeRetainedNamespacePrivateCapsule capsule,NativeRetainedNamespaceCustodyLayout.Observation layout,
        VaultSnapshot vault,NativeRetainedWorkCapture frozenWork,NativeProviderPrincipal principal)throws VaultFailure {
        requireCustodyLayoutIdentity(layout);custodyCipher.verifyPrivateNamespaceCapsule(capsule,this,encoded,layout,vault,frozenWork,principal);
    }
    /** Fixed original-key adapter, not a supplied cipher or recovery authority. */
    synchronized NativeRetainedNamespacePrivateCapsule restorePrivateCapsule(
        NativeRetainedNamespaceCustodyLayout.Observation layout,NativeRetainedNamespacePrivateCapsule.SavedLocalRecord record,
        VaultSnapshot vault,NativeRetainedWorkCapture frozenWork,NativeProviderPrincipal principal)throws VaultFailure {
        requireCustodyLayoutIdentity(layout);
        return custodyCipher.restorePrivateNamespaceCapsule(this,encoded,layout,record,vault,frozenWork,principal);
    }
    synchronized void requireOriginalPrivateCustodyKey(VaultSnapshot vault,
        NativeRetainedWorkCapture frozenWork,NativeProviderPrincipal principal)throws VaultFailure {
        requireOpen();custodyCipher.requireOriginalNamespaceCustodyKey(vault,frozenWork,principal);
    }
    synchronized void requireOpen() throws VaultFailure {if(encoded==null)throw invalid();}
    @Override public synchronized void close(){if(encoded!=null)Arrays.fill(encoded,(byte)0);encoded=null;}
    // Logical byte-buffer wipe only, not secure-erasure of JVM strings, copies,
    // original stores, disk, managed history or external telemetry/backups.

    private static Map<String,Map<String,?>> copy(Map<String,Map<String,?>> all) throws VaultFailure {
        if(all==null||!all.keySet().equals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()))throw invalid();
        Map<String,Map<String,?>> result=new TreeMap<>();Budget budget=new Budget();
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            Map<String,?> source=all.get(name);if(source==null||source.size()>4096)throw invalid();
            Map<String,Object> rows=new TreeMap<>();int count=0;
            for(var entry:source.entrySet()){
                if(++count>4096||++budget.records>32768)throw invalid();
                String key=entry.getKey();Object value=entry.getValue();
                if(key==null||key.isEmpty()||key.length()>1024||rows.containsKey(key))throw invalid();budget.text(key);
                if(value instanceof String)budget.text((String)value,
                    NativeRetainedNamespaceCensus.WORK.equals(name)?NativeProtectedWorkSnapshot.retainedStringLimit(key):524288);
                else if(value instanceof Set<?>){
                    if(((Set<?>)value).size()>4096)throw invalid();Set<String> items=new HashSet<>();int n=0;
                    for(Object item:(Set<?>)value){if(++n>4096||!(item instanceof String)||!items.add((String)item))throw invalid();budget.text((String)item);}
                    if(n!=((Set<?>)value).size())throw invalid();value=Collections.unmodifiableSet(items);
                }else if(!(value instanceof Integer||value instanceof Long||value instanceof Boolean||value instanceof Float))throw invalid();
                rows.put(key,value);
            }
            if(count!=source.size()||!sameRows(rows,source))throw invalid();result.put(name,Collections.unmodifiableMap(rows));
        }
        if(!same(result,all))throw invalid();return Collections.unmodifiableMap(result);
    }
    private static final class Budget {
        int records;long characters;
        void text(String value) throws VaultFailure {text(value,524288);}
        void text(String value,int cellLimit) throws VaultFailure {if(value.length()>cellLimit||(characters+=value.length())>8388608)throw invalid();}
    }
    private static boolean same(Map<String,Map<String,?>> a,Map<String,Map<String,?>> b) throws VaultFailure {
        if(a==null||b==null||!a.keySet().equals(b.keySet()))return false;
        for(String name:a.keySet())if(!sameRows(a.get(name),b.get(name)))return false;return true;
    }
    private static boolean sameRows(Map<String,?> a,Map<String,?> b) throws VaultFailure {
        if(a==null||b==null||a.size()!=b.size()||!a.keySet().equals(b.keySet()))return false;
        for(String key:a.keySet()){
            Object x=a.get(key),y=b.get(key);
            if(x instanceof Float){if(!(y instanceof Float)||Float.floatToRawIntBits((Float)x)!=Float.floatToRawIntBits((Float)y))return false;}
            else if(x==null||y==null||x.getClass()!=y.getClass()&&!(x instanceof Set<?> && y instanceof Set<?>))return false;
            else if(!x.equals(y))return false;
        }return true;
    }
    private static byte[] encode(Map<String,Map<String,?>> all,String captureIdentity) throws VaultFailure {
        Output out=new Output();out.text(SCHEMA);out.text(captureIdentity);out.int32(8);
        for(String name:new TreeSet<>(all.keySet())){
            out.text(name);Map<String,?> rows=all.get(name);out.int32(rows.size());
            for(String key:new TreeSet<>(rows.keySet())){
                out.text(key);Object value=rows.get(key);
                if(value instanceof String){out.put(1);out.text((String)value);}
                else if(value instanceof Integer){out.put(2);out.int32((Integer)value);}
                else if(value instanceof Long){out.put(3);out.int64((Long)value);}
                else if(value instanceof Boolean){out.put(4);out.put((Boolean)value?1:0);}
                else if(value instanceof Float){out.put(5);out.int32(Float.floatToRawIntBits((Float)value));}
                else if(value instanceof Set<?>){out.put(6);TreeSet<String> items=new TreeSet<>();for(Object item:(Set<?>)value)items.add((String)item);
                    out.int32(items.size());for(String item:items)out.text(item);}
                else throw invalid();
            }
        }return out.bytes();
    }
    private static final class Output {
        private final ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        void put(int value) throws VaultFailure {if(bytes.size()>=MAX_BYTES)throw invalid();bytes.write(value&255);}
        void int32(int value) throws VaultFailure {for(int shift=24;shift>=0;shift-=8)put(value>>>shift);}
        void int64(long value) throws VaultFailure {for(int shift=56;shift>=0;shift-=8)put((int)(value>>>shift));}
        void text(String value) throws VaultFailure {int32(value.length());for(int i=0;i<value.length();i++){char c=value.charAt(i);put(c>>>8);put(c);}}
        byte[] bytes(){return bytes.toByteArray();}
    }
    private static String hash(byte[] value) throws VaultFailure {
        try {StringBuilder out=new StringBuilder(64);for(byte b:MessageDigest.getInstance("SHA-256").digest(value)){
            out.append(Character.forDigit((b&255)>>>4,16)).append(Character.forDigit(b&15,16));}return out.toString();}
        catch(Exception error){throw invalid();}
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
