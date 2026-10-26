package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Synthetic binary/name DATA only; no private issuer, control or ACK proof. */
public final class NativeOriginalInventoryManifestNamesTest {
    public static void main(String[] args)throws Exception{
        if(args.length!=1||!"--names-projection-only".equals(args[0]))throw new IllegalArgumentException();
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(
            NativeOriginalInventoryManifestNamesTest.class,"NAMES_actualBinaryCatalogAndOrdinalProjection"));
        for(var failure:result.getFailures())System.err.println(failure.getTrace());
        System.out.println("NAMES_actualBinaryCatalogAndOrdinalProjection run="+result.getRunCount()+" failures="+result.getFailureCount());
        if(!result.wasSuccessful()||result.getRunCount()!=1)System.exit(1);
    }
    @Test public void NAMES_actualBinaryCatalogAndOrdinalProjection()throws Exception{
        String high="hi"+(char)0xd800,low="lo"+(char)0xdc00,pair="pair"+(char)0xd83d+(char)0xde03;
        String longStore="z".repeat(32768)+(char)0xd800;
        Object[] repeated=arr(row("same","value"),row("same","value"));
        Object[] databases=arr(
            arr(arr("",1),arr()),
            arr(arr("a",2),arr(arr("b\u0000c",repeated),arr(longStore,one(row("long","value"))))),
            arr(arr("a\u0000b",3),one(arr("c",one(row("other","value"))))),
            arr(arr(high,4),one(arr(""+(char)0xdc00,one(row("high","value"))))),
            arr(arr(low,5),one(arr(""+(char)0xd800,arr()))),
            arr(arr(pair,6),one(arr("paired",one(row("pair","value"))))),
            arr(arr("stores-empty",7),one(arr("",arr()))));
        Object[] tree=arr(one(arr("local","retained")),null,databases);
        var original=read(tree);
        var projection=NativeOriginalInventoryManifestNames.project(original);
        assertEquals(7,original.recordCount);assertEquals(10,projection.domains.length());
        assertEquals(7,projection.declaredRecordCount);
        var emittedRows=new JSONArray();int[] counts=new int[projection.domains.length()];
        for(var row:original.originalRecords()){
            int domain=projection.domainOrdinal(row);counts[domain]++;
            emittedRows.put(new JSONObject().put("ordinal",row.ordinal).put("domain_ordinal",domain)
                .put("key_sha256",row.keySha256).put("body_sha256",row.bodySha256)
                .put("disposition",row.semanticDisposition));
        }
        projection.finish();
        var value=new JSONObject().put("browser_realm_name_encoding",NativeOriginalInventoryManifestNames.ENCODING)
            .put("browser_domains",projection.domains).put("browser_records",emittedRows);
        byte[] encoded=value.toString().getBytes(StandardCharsets.UTF_8);
        for(byte b:encoded)assertTrue("projection must be ASCII",b>=0);
        var detached=ProviderWireJson.object(encoded,1024*1024);
        assertEquals("UTF16_CODE_UNITS_BE_BASE64",detached.getString("browser_realm_name_encoding"));
        var domains=detached.getJSONArray("browser_domains");var catalog=original.declaredDomains();
        for(int i=0;i<catalog.size();i++){
            var expected=catalog.get(i);var domain=domains.getJSONObject(i);
            assertEquals(i,domain.getInt("domain_ordinal"));assertEquals(expected.store,domain.getString("store"));
            assertEquals(expected.state,domain.getString("state"));
            sameName(expected.database,domain,"database_utf16be_base64");
            sameName(expected.objectStore,domain,"object_store_utf16be_base64");
            if(expected.version==null)assertTrue(domain.isNull("version"));
            else assertEquals(expected.version.longValue(),domain.getLong("version"));
            if(expected.recordCount<0){assertTrue(domain.isNull("record_count"));assertEquals(0,counts[i]);}
            else{assertEquals(expected.recordCount,domain.getInt("record_count"));assertEquals(expected.recordCount,counts[i]);}
            assertFalse(domain.has("database"));assertFalse(domain.has("object_store"));
        }
        assertEquals("UNAVAILABLE_UNRESOLVED_RETAINED",domains.getJSONObject(1).getString("state"));
        assertEquals("DECLARED_EMPTY_DATABASE_NOT_AUTHORITY",domains.getJSONObject(2).getString("state"));
        assertTrue(domains.getJSONObject(2).isNull("object_store_utf16be_base64"));
        assertEquals("",domains.getJSONObject(9).getString("object_store_utf16be_base64"));
        for(int i=0;i<emittedRows.length();i++){
            var row=detached.getJSONArray("browser_records").getJSONObject(i);
            assertEquals(i,row.getInt("ordinal"));assertEquals(5,row.length());
            assertFalse(row.has("database"));assertFalse(row.has("object_store"));assertFalse(row.has("store"));
            assertEquals("UNRESOLVED_RETAINED",row.getString("disposition"));
        }
        assertEquals(emittedRows.getJSONObject(1).getString("key_sha256"),emittedRows.getJSONObject(2).getString("key_sha256"));
        assertEquals(emittedRows.getJSONObject(1).getInt("domain_ordinal"),emittedRows.getJSONObject(2).getInt("domain_ordinal"));
        assertNotEquals(emittedRows.getJSONObject(1).getInt("domain_ordinal"),emittedRows.getJSONObject(4).getInt("domain_ordinal"));
        // Census refuses omitted, duplicate or foreign actual parsed rows;
        // no reflection/private records or source capability is fabricated.
        var omitted=NativeOriginalInventoryManifestNames.project(original);
        omitted.domainOrdinal(original.originalRecords().get(0));refuses(omitted::finish);
        refuses(()->omitted.domainOrdinal(original.originalRecords().get(1)));
        var duplicate=NativeOriginalInventoryManifestNames.project(original);
        duplicate.domainOrdinal(original.originalRecords().get(0));
        refuses(()->duplicate.domainOrdinal(original.originalRecords().get(0)));
        var foreign=NativeOriginalInventoryManifestNames.project(original);var separatelyParsed=read(tree);
        refuses(()->foreign.domainOrdinal(separatelyParsed.originalRecords().get(0)));
        refuses(()->projection.domainOrdinal(original.originalRecords().get(0)));
        var known=read(arr(arr(),arr(),arr(arr(arr("empty",1),arr()),arr(arr("stores",1),one(arr("",arr()))))));
        var empty=NativeOriginalInventoryManifestNames.project(known);empty.finish();
        assertEquals(0,empty.domains.getJSONObject(1).getInt("record_count"));
        assertEquals("DECLARED_ORIGINAL_ROWS_NOT_AUTHORITY",empty.domains.getJSONObject(1).getString("state"));
        assertEquals(0,empty.declaredRecordCount);
    }
    private static void sameName(String original,JSONObject realm,String key)throws Exception{
        if(original==null){assertTrue(realm.isNull(key));return;}
        String text=realm.getString(key);byte[] bytes=Base64.getDecoder().decode(text);
        assertEquals(text,Base64.getEncoder().encodeToString(bytes));assertEquals(original.length()*2,bytes.length);
        char[] units=new char[bytes.length/2];
        for(int i=0;i<units.length;i++)units[i]=(char)(((bytes[i*2]&255)<<8)|(bytes[i*2+1]&255));
        assertEquals(original,new String(units));Arrays.fill(bytes,(byte)0);Arrays.fill(units,'\0');
    }
    private interface Checked {void run()throws Exception;}
    private static void refuses(Checked action)throws Exception{
        try{action.run();fail("expected original-census refusal");}catch(VaultFailure expected){}
    }
    private static Object[] arr(Object... values){return values;}
    private static Object[] one(Object value){return new Object[]{value};}
    private static Object[] row(String key,String value){return arr(arr("string",key),arr("string",value));}

    /** Same ordinary DATA fixture encoding as the existing frame family;
     * only the shipping reader constructs OriginalRecords/Domain/Record. */
    private static NativeOriginalBrowserValueFrame.OriginalRecords read(Object[] tree)throws Exception{
        Object[] local=(Object[])tree[0],session=(Object[])tree[1],databases=(Object[])tree[2];
        int count=local.length+(session==null?0:session.length);
        for(Object db:databases)for(Object store:(Object[])((Object[])db)[1])count+=((Object[])((Object[])store)[1]).length;
        String transcript="[\"custodial.browser-protected-observation.v1\",{\"local\":"+json(local)
            +",\"session\":"+json(session)+",\"databases\":"+json(databases)+"}]";
        String observation=NativeRetainedAttempt.hash(codeUnits(transcript));
        var bytes=new ByteArrayOutputStream();
        try(var out=new DataOutputStream(bytes)){
            out.write("MZBRV001".getBytes(StandardCharsets.US_ASCII));out.write(java.util.HexFormat.of().parseHex(observation));
            out.writeInt(local.length);out.writeInt(session==null?-1:session.length);
            out.writeInt(databases.length);out.writeInt(count);binary(out,tree);
        }
        byte[] frame=bytes.toByteArray();var chunks=new ArrayList<byte[]>();var hashes=new JSONArray();
        for(int i=0;i<frame.length;i+=1048576){
            byte[] chunk=Arrays.copyOfRange(frame,i,Math.min(i+1048576,frame.length));
            chunks.add(chunk);hashes.put(NativeRetainedAttempt.hash(chunk));
        }
        var metadata=new JSONObject().put("schema","custodial.browser-original-value-frame.v1").put("encoding","MZBRV001")
            .put("observation_sha256",observation).put("frame_sha256",NativeRetainedAttempt.hash(frame))
            .put("byte_count",frame.length).put("chunk_bytes",1048576).put("chunk_count",chunks.size())
            .put("record_count",count).put("session_storage_state",session==null?"NOT_DECLARED_UNKNOWN":"CAPTURED_READ_ONLY_NOT_AUTHENTICATED")
            .put("chunk_sha256",hashes);
        for(String flag:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"})
            metadata.put(flag,false);
        try{return NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,chunks,List.of());}
        finally{Arrays.fill(frame,(byte)0);for(byte[] chunk:chunks)Arrays.fill(chunk,(byte)0);}
    }
    private static byte[] codeUnits(String value){
        byte[] bytes=new byte[value.length()*2];
        for(int i=0;i<value.length();i++){bytes[i*2]=(byte)(value.charAt(i)>>>8);bytes[i*2+1]=(byte)value.charAt(i);}
        return bytes;
    }
    private static void binary(DataOutputStream out,Object value)throws Exception{
        if(value==null){out.writeByte(0);return;}
        if(value instanceof String){String s=(String)value;out.writeByte(4);out.writeInt(s.length());for(int i=0;i<s.length();i++)out.writeChar(s.charAt(i));return;}
        if(value instanceof Number){out.writeByte(3);out.writeDouble(((Number)value).doubleValue());return;}
        Object[] array=(Object[])value;out.writeByte(5);out.writeInt(array.length);for(Object v:array)binary(out,v);
    }
    private static String json(Object value){
        if(value==null)return "null";
        if(value instanceof Number)return Long.toString(((Number)value).longValue());
        if(value instanceof String){
            String s=(String)value;StringBuilder out=new StringBuilder("\"");
            for(int i=0;i<s.length();i++){
                char c=s.charAt(i);
                if(c=='"'||c=='\\')out.append('\\').append(c);
                else if(c=='\b')out.append("\\b");else if(c=='\f')out.append("\\f");
                else if(c=='\n')out.append("\\n");else if(c=='\r')out.append("\\r");else if(c=='\t')out.append("\\t");
                else if(Character.isHighSurrogate(c)&&i+1<s.length()&&Character.isLowSurrogate(s.charAt(i+1)))out.append(c).append(s.charAt(++i));
                else if(c<32||Character.isSurrogate(c))out.append("\\u").append(String.format(java.util.Locale.ROOT,"%04x",(int)c));
                else out.append(c);
            }return out.append('"').toString();
        }
        StringBuilder out=new StringBuilder("[");Object[] array=(Object[])value;
        for(int i=0;i<array.length;i++){if(i>0)out.append(',');out.append(json(array[i]));}return out.append(']').toString();
    }
}
