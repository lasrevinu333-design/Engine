package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import org.junit.Test;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

public class NativeRetainedRecordValuesTest {
    private static String hex(String value) {
        StringBuilder out = new StringBuilder();
        for (int i=0;i<value.length();i++) for (int shift=12;shift>=0;shift-=4)
            out.append(Character.forDigit((value.charAt(i)>>>shift)&15,16));
        return out.toString();
    }
    private static String text(String hex) {
        StringBuilder out=new StringBuilder();
        for(int i=0;i<hex.length();i+=4)out.append((char)Integer.parseInt(hex.substring(i,i+4),16));
        return out.toString();
    }
    static Map<String,Object> fixture() {
        Map<String,Object> values=new LinkedHashMap<>();
        values.put("opaque_unknown_work", "SYNTHETIC unreadable original ciphertext ".repeat(400));
        values.put("int_min",Integer.MIN_VALUE); values.put("int_max",Integer.MAX_VALUE);
        values.put("long_min",Long.MIN_VALUE); values.put("long_max",Long.MAX_VALUE);
        values.put("true",Boolean.TRUE);values.put("false",Boolean.FALSE);
        values.put("float_zero",Float.intBitsToFloat(0));
        values.put("float_negative_zero",Float.intBitsToFloat(0x80000000));
        values.put("float_nan",Float.intBitsToFloat(0x7fc00001));
        values.put("float_infinity",Float.POSITIVE_INFINITY);
        values.put("string_set",new HashSet<>(Arrays.asList("", "a", "bc", "\\uD800")));
        values.put("\uD800", "bad\uDC00\u0000bytes");
        return values;
    }
    private static Map<String,Object> decode(byte[] bytes) {
        JSONObject payload=new JSONObject(new String(bytes,StandardCharsets.US_ASCII));
        assertEquals(NativeRetainedRecordValues.SCHEMA,payload.getString("schema"));
        Map<String,Object> values=new TreeMap<>();JSONArray rows=payload.getJSONArray("records");
        for(int i=0;i<rows.length();i++) {
            JSONArray row=rows.getJSONArray(i);String key=text(row.getString(0)),type=row.getString(1);Object value;
            switch(type) {
                case "string":value=text(row.getString(2));break;
                case "int32":value=Integer.valueOf(row.getString(2));break;
                case "int64":value=Long.valueOf(row.getString(2));break;
                case "boolean":value=row.getBoolean(2);break;
                case "float32":value=Float.intBitsToFloat(Integer.parseUnsignedInt(row.getString(2),16));break;
                case "string-set":Set<String> items=new HashSet<>();JSONArray set=row.getJSONArray(2);
                    for(int n=0;n<set.length();n++)items.add(text(set.getString(n)));value=items;break;
                default:throw new AssertionError("unsupported encoded type");
            }
            assertNull(values.put(key,value));
        }
        return values;
    }
    private interface Attempt { void run() throws Exception; }
    private static void refuse(Attempt run) throws Exception {
        try { run.run(); fail("must refuse, never discard or coerce"); }
        catch(VaultFailure expected) {
            assertTrue(expected.code.equals(NativeRetainedRecordValues.FAILURE)
                || expected.code.equals(NativeProtectedWorkSnapshot.FAILURE));
        }
    }
    @Test public void emptyHasOnlyCanonicalBytesNotEmptyQueueAuthority() throws Exception {
        NativeRetainedRecordValues value=NativeRetainedRecordValues.capture(Collections.emptyMap());
        assertEquals("{\"schema\":\"custodial.retained-native-record-values.v1\",\"records\":[]}",new String(value.bytes(),StandardCharsets.US_ASCII));
        assertEquals(0,value.snapshot().recordCount);
    }
    @Test public void allOriginalSupportedRawTypesRoundtripAndUseUnchangedDigestCode() throws Exception {
        Map<String,Object> original=fixture();NativeRetainedRecordValues value=NativeRetainedRecordValues.capture(original);
        assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(original,decode(value.bytes())));
        assertEquals(NativeProtectedWorkSnapshot.capture(original).digest,value.snapshot().digest);
        assertEquals(original.size(),value.snapshot().recordCount);
    }
    @Test public void canonicalOrderIndependentOfMapAndSetInsertion() throws Exception {
        Map<String,Object> first=fixture(),second=new LinkedHashMap<>();List<String> keys=new ArrayList<>(first.keySet());Collections.reverse(keys);
        for(String key:keys)second.put(key,first.get(key));
        second.put("string_set",new LinkedHashSet<>(Arrays.asList("bc","a","","\\uD800")));
        assertArrayEquals(NativeRetainedRecordValues.capture(first).bytes(),NativeRetainedRecordValues.capture(second).bytes());
    }
    @Test public void integersAreLosslessQuotedDecimalNotJsonDouble() throws Exception {
        JSONArray rows=new JSONObject(new String(NativeRetainedRecordValues.capture(fixture()).bytes(),StandardCharsets.US_ASCII)).getJSONArray("records");
        for(int i=0;i<rows.length();i++){JSONArray r=rows.getJSONArray(i);if(r.getString(1).startsWith("int"))assertTrue(r.get(2) instanceof String);}
        assertEquals(Long.MIN_VALUE,decode(NativeRetainedRecordValues.capture(fixture()).bytes()).get("long_min"));
    }
    @Test public void signedZeroNanPayloadAndInfinityRawBitsSurvive() throws Exception {
        Map<String,Object> result=decode(NativeRetainedRecordValues.capture(fixture()).bytes());
        assertEquals(0x80000000,Float.floatToRawIntBits((Float)result.get("float_negative_zero")));
        assertEquals(0x7fc00001,Float.floatToRawIntBits((Float)result.get("float_nan")));
        assertEquals(0x7f800000,Float.floatToRawIntBits((Float)result.get("float_infinity")));
    }
    @Test public void unpairedKeyAndValueSurrogatesNeverReplacementDecode() throws Exception {
        Map<String,Object> raw=new HashMap<>();raw.put("\uD800","\uDC00\u0000");
        JSONArray row=new JSONObject(new String(NativeRetainedRecordValues.capture(raw).bytes(),StandardCharsets.US_ASCII)).getJSONArray("records").getJSONArray(0);
        assertEquals("d800",row.getString(0));assertEquals("dc000000",row.getString(2));
    }
    @Test public void opaqueUnknownCiphertextIncludedWithoutDecryption() throws Exception {
        Map<String,Object> raw=new HashMap<>();raw.put("unknown_work_kind","SYNTHETIC_CORRUPT_CIPHERTEXT");
        assertEquals("SYNTHETIC_CORRUPT_CIPHERTEXT",decode(NativeRetainedRecordValues.capture(raw).bytes()).get("unknown_work_kind"));
    }
    @Test public void byteArrayAndCallerSetCannotMutatePreparedValue() throws Exception {
        Map<String,Object> raw=fixture();NativeRetainedRecordValues value=NativeRetainedRecordValues.capture(raw);
        byte[] before=value.bytes(),copy=value.bytes();Arrays.fill(copy,(byte)0);((Set<String>)raw.get("string_set")).clear();
        assertArrayEquals(before,value.bytes());assertEquals(value.sha256,NativeProviderPrincipal.hash(new String(before,StandardCharsets.US_ASCII)));
        assertEquals(value.byteCount,before.length);
    }
    @Test public void unsupportedNullDoubleAndNonStringSetRefuseRatherThanOmit() throws Exception {
        for(Object bad:new Object[]{null,Double.valueOf(1),new Object(),new HashSet<>(Arrays.asList("ok",Integer.valueOf(1)))}) {
            Map<String,Object> raw=new HashMap<>();raw.put("unknown",bad);refuse(()->NativeRetainedRecordValues.capture(raw));
        }
    }
    @Test public void nullEmptyOversizedAndReservedMarkerKeysRefused() throws Exception {
        for(String key:new String[]{null,"","x".repeat(1025),"native_separation_freeze.v1","native_separation_probe.v1"}){
            Map<String,Object> raw=new HashMap<>();raw.put(key,"original");refuse(()->NativeRetainedRecordValues.capture(raw));
        }
    }
    @Test public void fieldRecordSetAndTotalUnitBudgetsPreserveOriginalLimits() throws Exception {
        refuse(()->NativeRetainedRecordValues.capture(Collections.singletonMap("x","x".repeat(524289))));
        Map<String,Object> records=new HashMap<>();for(int i=0;i<4097;i++)records.put("r"+i,"x");
        refuse(()->NativeRetainedRecordValues.capture(records));
        Set<String> set=new HashSet<>();for(int i=0;i<4097;i++)set.add("r"+i);
        refuse(()->NativeRetainedRecordValues.capture(Collections.singletonMap("x",set)));
        Map<String,Object> total=new HashMap<>();String item="x".repeat(524288);for(int i=0;i<17;i++)total.put("r"+i,item);
        refuse(()->NativeRetainedRecordValues.capture(total));
    }
    @Test public void supportedMaximumSingleStringStaysAsciiAndExact() throws Exception {
        String text="x".repeat(524288);NativeRetainedRecordValues value=NativeRetainedRecordValues.capture(Collections.singletonMap("x",text));
        assertEquals(text,decode(value.bytes()).get("x"));for(byte b:value.bytes())assertTrue(b>=32&&b<=126);
    }
    @Test public void malformedSetDuplicateIteratorRefusedBeforeCoercion() throws Exception {
        Set<String> bad=new AbstractSet<String>() {
            public int size(){return 2;}public Iterator<String> iterator(){return Arrays.asList("same","same").iterator();}
        };
        refuse(()->NativeRetainedRecordValues.capture(Collections.singletonMap("x",bad)));
    }
    @Test public void malformedSetInfiniteIteratorBounded() throws Exception {
        Set<String> bad=new AbstractSet<String>() {
            public int size(){return 1;}public Iterator<String> iterator(){return new Iterator<String>() {
                int n;public boolean hasNext(){return true;}public String next(){return String.valueOf(n++);}
            };}
        };
        refuse(()->NativeRetainedRecordValues.capture(Collections.singletonMap("x",bad)));
    }
    @Test public void callerMutationDuringCopyNeverSilentlyAdopted() throws Exception {
        Map<String,Object> raw=new LinkedHashMap<String,Object>() {
            public Set<Map.Entry<String,Object>> entrySet(){
                Set<Map.Entry<String,Object>> entries=super.entrySet();Map<String,Object> self=this;
                return new AbstractSet<Map.Entry<String,Object>>() {
                    public int size(){return entries.size();}
                    public Iterator<Map.Entry<String,Object>> iterator(){Iterator<Map.Entry<String,Object>> it=entries.iterator();
                        return new Iterator<Map.Entry<String,Object>>() {
                            public boolean hasNext(){boolean more=it.hasNext();if(!more)self.put("x",Integer.valueOf(2));return more;}
                            public Map.Entry<String,Object> next(){return it.next();}
                        };
                    }
                };
            }
        };
        raw.put("x",Integer.valueOf(1));refuse(()->NativeRetainedRecordValues.capture(raw));
    }
    @Test public void noNetworkStoreSignerAcknowledgementOrWebviewAuthority() throws Exception {
        assertEquals(40*1024*1024,NativeRetainedRecordValues.MAX_BYTES);
        for(java.lang.reflect.Method method:NativeRetainedRecordValues.class.getDeclaredMethods()) {
            String name=method.getName().toLowerCase(Locale.ROOT);
            assertFalse(name.contains("send")||name.contains("http")||name.contains("ack")||name.contains("decrypt")||name.contains("sign")||name.contains("commit"));
        }
        refuse(()->NativeRetainedRecordValues.capture(null));
        try{RequestPolicy.validate(new AuthorizedRequest("/device-auth/separation-evidence","POST",Collections.emptyMap(),new byte[0]),"KIOSK_08");fail("no new WebView authority");}
        catch(VaultFailure expected){assertEquals("custodial_native_path_refused",expected.code);}
    }
}
