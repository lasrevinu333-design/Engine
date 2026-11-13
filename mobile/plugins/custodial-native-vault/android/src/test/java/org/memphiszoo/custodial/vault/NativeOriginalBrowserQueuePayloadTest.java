package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Synthetic DATA codec cases only; no browser/native source authentication,
 * SQL result, current owner, transport, ACK, finalizer or real key is created. */
public final class NativeOriginalBrowserQueuePayloadTest {
    private static final String SESSION="11111111-1111-4111-8111-111111111111";
    private static final String COMPLETION="22222222-2222-4222-8222-222222222222";
    private static final String FINISH="33333333-3333-4333-8333-333333333333";
    private static final String OPERATION="44444444-4444-4444-8444-444444444444";
    private static final NativeOriginalBrowserQueuePayload.State MATCH=NativeOriginalBrowserQueuePayload.State.MATCHED_ORIGINAL_PAYLOAD_NOT_AUTHORITY;
    private static final NativeOriginalBrowserQueuePayload.State HELD=NativeOriginalBrowserQueuePayload.State.UNRESOLVED_RETAINED;
    private static byte[] bytes(String text){return text.getBytes(StandardCharsets.UTF_8);}
    private static JSONObject arguments(){return new JSONObject().put("p_device_id","KIOSK_08").put("p_client_session_id",SESSION)
        .put("p_client_completion_id",COMPLETION).put("p_native_finish_scan_entry_id",FINISH);}
    private static JSONObject row(JSONObject args){return new JSONObject().put("id",7).put("schema_version",6)
        .put("type","commit_workflow").put("operation_id",OPERATION).put("payload",args);}
    private static JSONArray number(double value){return new JSONArray().put("float64").put(String.format(java.util.Locale.ROOT,"%016x",Double.doubleToRawLongBits(value)));}
    private static JSONArray tag(Object value)throws Exception{
        if(value==JSONObject.NULL)return new JSONArray().put("null");
        if(value instanceof JSONObject){JSONArray pairs=new JSONArray();JSONObject object=(JSONObject)value;
            for(String key:object.keySet())pairs.put(new JSONArray().put(key).put(tag(object.get(key))));return new JSONArray().put("object").put(pairs);}
        if(value instanceof JSONArray){JSONArray items=new JSONArray();JSONArray list=(JSONArray)value;
            for(int i=0;i<list.length();i++)items.put(tag(list.get(i)));return new JSONArray().put("array").put(items);}
        if(value instanceof String)return new JSONArray().put("string").put(value);
        if(value instanceof Boolean)return new JSONArray().put("boolean").put(value);
        if(value instanceof Number)return number(((Number)value).doubleValue());throw new AssertionError("fixture type");
    }
    private static NativeOriginalBrowserQueuePayload.State match(JSONObject row,JSONObject args)throws Exception{
        return NativeOriginalBrowserQueuePayload.matchOriginalPayload(bytes(number(7).toString()),bytes(tag(row).toString()),bytes(args.toString()));
    }
    private static JSONArray pairs(JSONArray object){return object.getJSONArray(1);}
    private static void replace(JSONArray object,String name,JSONArray value)throws Exception{
        for(int i=0;i<pairs(object).length();i++){JSONArray pair=pairs(object).getJSONArray(i);if(name.equals(pair.get(0))){pair.put(1,value);return;}}
        throw new AssertionError(name);
    }
    private static NativeOriginalBrowserQueuePayload.State tagged(JSONArray value,String args){
        return NativeOriginalBrowserQueuePayload.matchOriginalPayload(bytes("[\"float64\",\"401c000000000000\"]"),bytes(value.toString()),bytes(args));
    }

    public static void main(String[] args)throws Exception{
        // WHOLE_ROW_SELECTOR_BEGIN
        if(args.length==1&&"--browser-original-whole-row-index-only".equals(args[0])){
            for(String name:new String[]{"ROWINDEX_validDirectForwardAndExactDataFields","ROWINDEX_ownedPayloadNotCallerBufferOrArgumentCache",
                "ROWINDEX_eachOriginalIdentityRemainsDistinct","ROWINDEX_foreignIdentityNeverAdoptsArgumentActor",
                "ROWINDEX_closeClearsOwnedGraphAndRefusesFutureMatch","ROWINDEX_duplicateUnsupportedAndMalformedRefuse",
                "ROWINDEX_safeNumbersAndOriginalIdentityChecks","ROWINDEX_argumentBoundsStrictnessAndNonCoercion",
                "ROWINDEX_privateConstructionNoRawGetterOrAuthority"}){
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeOriginalBrowserQueuePayloadTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_SYNTHETIC_ROW_DATA_ONLY "+name);
            }
            System.out.println("NEW_ROW_INDEX_9_ONLY_NO_SOURCE_ACCEPTANCE_OR_ACK");return;
        }
        // WHOLE_ROW_SELECTOR_END
        if(args.length!=1||!"--browser-original-payload-match-only".equals(args[0]))throw new IllegalArgumentException("new payload DATA cases only");
        for(String name:new String[]{"PAYLOAD_directExactTaggedVectorAndTypes","PAYLOAD_forwardAndVersions",
            "PAYLOAD_changedOrExtraPayloadRetained","PAYLOAD_originalRowIdentityAndShape",
            "PAYLOAD_uuidDeviceAndCompletionBinding","PAYLOAD_safeIeeeIdentityNotNumericCoercion",
            "PAYLOAD_negativeZeroAndUnsafeNumbersRetained","PAYLOAD_duplicateKeysRetained",
            "PAYLOAD_unsupportedTagsAndArityRetained","PAYLOAD_strictJsonUtf8AndSurrogates",
            "PAYLOAD_sizeDepthAndParserCeilingsRetained","PAYLOAD_callerArraysPreservedAndDataOnlyState"}){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeOriginalBrowserQueuePayloadTest.class,name));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
            }
            System.out.println("PASS_SYNTHETIC_DATA_ONLY "+name);
        }
        System.out.println("NEW_PAYLOAD_12_ONLY_NO_SOURCE_SQL_AUTH_ACK_OR_EFFECT_AUTHORITY");
    }

    // WHOLE_ROW_TESTS_BEGIN
    private static NativeOriginalBrowserQueuePayload.OriginalQueueRow inspect(JSONObject value)throws Exception{
        return NativeOriginalBrowserQueuePayload.inspectOriginalRow(bytes(number(7).toString()),bytes(tag(value).toString()));
    }
    @Test public void ROWINDEX_validDirectForwardAndExactDataFields()throws Exception{
        for(int version=1;version<=6;version++)for(boolean forward:new boolean[]{false,true}){
            JSONObject args=arguments().put("n",7).put("nested",new JSONArray().put(true).put(JSONObject.NULL));
            JSONObject original=row(args).put("schema_version",version).put("completion_client_id",COMPLETION);
            if(forward)original.put("type","forward-replay-fenced:commit_workflow").put("forward_action_type","commit_workflow")
                .put("forward_replay_contract","scan.v4.snapshot-bound-authority");
            try(var indexed=inspect(original)){
                assertNotNull(indexed);assertEquals(7L,indexed.primaryId);assertEquals(OPERATION,indexed.operationId);
                assertEquals("KIOSK_08",indexed.deviceId);assertEquals(SESSION,indexed.clientSessionId);assertEquals(COMPLETION,indexed.clientCompletionId);
                assertEquals(MATCH,indexed.matchOriginalArgument(bytes(args.toString())));
            }
        }
    }
    @Test public void ROWINDEX_ownedPayloadNotCallerBufferOrArgumentCache()throws Exception{
        JSONObject args=arguments().put("saved","original");byte[] key=bytes(number(7).toString()),value=bytes(tag(row(args)).toString());
        byte[] beforeKey=key.clone(),beforeValue=value.clone();
        try(var indexed=NativeOriginalBrowserQueuePayload.inspectOriginalRow(key,value)){
            assertNotNull(indexed);assertArrayEquals(beforeKey,key);assertArrayEquals(beforeValue,value);
            Arrays.fill(key,(byte)'!');Arrays.fill(value,(byte)'!');
            byte[] raw=bytes(args.toString()),beforeRaw=raw.clone();assertEquals(MATCH,indexed.matchOriginalArgument(raw));assertArrayEquals(beforeRaw,raw);
            Arrays.fill(raw,(byte)'!');assertEquals(HELD,indexed.matchOriginalArgument(raw));
            assertEquals(HELD,indexed.matchOriginalArgument(bytes(new JSONObject(args.toString()).put("saved","successor").toString())));
            assertEquals(MATCH,indexed.matchOriginalArgument(bytes(args.toString())));
        }
    }
    @Test public void ROWINDEX_eachOriginalIdentityRemainsDistinct()throws Exception{
        JSONObject args=arguments();String otherOperation="55555555-5555-4555-8555-555555555555";
        try(var first=inspect(row(args));var other=inspect(row(args).put("operation_id",otherOperation));
            var changedPrimary=NativeOriginalBrowserQueuePayload.inspectOriginalRow(bytes(number(8).toString()),bytes(tag(row(args).put("id",8)).toString()))){
            assertNotNull(first);assertNotNull(other);assertNotNull(changedPrimary);assertNotSame(first,other);
            assertEquals(OPERATION,first.operationId);assertEquals(otherOperation,other.operationId);assertEquals(8,changedPrimary.primaryId);
            assertEquals(MATCH,first.matchOriginalArgument(bytes(args.toString())));assertEquals(MATCH,other.matchOriginalArgument(bytes(args.toString())));
            // Main must consider BOTH actual rows for ambiguity; this DATA
            // handle neither silently deduplicates nor labels either accepted.
            first.close();assertEquals(HELD,first.matchOriginalArgument(bytes(args.toString())));
            assertEquals(MATCH,other.matchOriginalArgument(bytes(args.toString())));
        }
    }
    @Test public void ROWINDEX_foreignIdentityNeverAdoptsArgumentActor()throws Exception{
        JSONObject original=arguments();
        for(String field:new String[]{"p_device_id","p_client_session_id","p_client_completion_id"}){
            JSONObject foreign=new JSONObject(original.toString()).put(field,field.equals("p_device_id")?"KIOSK_09":FINISH);
            try(var indexed=inspect(row(foreign))){
                assertNotNull(indexed);assertEquals(HELD,indexed.matchOriginalArgument(bytes(original.toString())));
                assertEquals(MATCH,indexed.matchOriginalArgument(bytes(foreign.toString())));
                if(field.equals("p_device_id"))assertEquals("KIOSK_09",indexed.deviceId);
            }
        }
        assertNull(inspect(row(original).put("type","foreign-action")));
        assertNull(inspect(row(original).put("completion_client_id",SESSION)));
    }
    @Test public void ROWINDEX_closeClearsOwnedGraphAndRefusesFutureMatch()throws Exception{
        JSONObject args=arguments().put("object",new JSONObject().put("array",new JSONArray().put("retained").put(new JSONObject().put("n",1))));
        var indexed=inspect(row(args));assertNotNull(indexed);
        var field=indexed.getClass().getDeclaredField("payload");field.setAccessible(true);
        var map=(java.util.Map<?,?>)field.get(indexed);
        var nested=(java.util.Map<?,?>)map.get("object");
        var list=(java.util.List<?>)nested.get("array");var child=(java.util.Map<?,?>)list.get(1);
        assertFalse(child.isEmpty());indexed.close();indexed.close();
        assertNull(field.get(indexed));assertTrue(map.isEmpty());assertTrue(nested.isEmpty());assertTrue(list.isEmpty());assertTrue(child.isEmpty());
        assertEquals(HELD,indexed.matchOriginalArgument(bytes(args.toString())));assertEquals(HELD,indexed.matchOriginalArgument(null));
        assertEquals(7,indexed.primaryId);assertEquals(OPERATION,indexed.operationId); // DATA strings are not claimed wiped.
    }
    @Test public void ROWINDEX_duplicateUnsupportedAndMalformedRefuse()throws Exception{
        JSONObject args=arguments();JSONArray value=tag(row(args));pairs(value).put(new JSONArray().put("id").put(number(7)));
        assertNull(NativeOriginalBrowserQueuePayload.inspectOriginalRow(bytes(number(7).toString()),bytes(value.toString())));
        value=tag(row(args));JSONArray payload=tag(args);pairs(payload).put(new JSONArray().put("p_device_id").put(new JSONArray().put("string").put("KIOSK_08")));
        replace(value,"payload",payload);assertNull(NativeOriginalBrowserQueuePayload.inspectOriginalRow(bytes(number(7).toString()),bytes(value.toString())));
        for(String kind:new String[]{"date","undefined","hole","binary"}){
            value=tag(row(args));pairs(value).put(new JSONArray().put("other").put(new JSONArray().put(kind)));
            assertNull(NativeOriginalBrowserQueuePayload.inspectOriginalRow(bytes(number(7).toString()),bytes(value.toString())));
        }
        for(byte[] bad:new byte[][]{null,new byte[0],bytes("{}"),bytes("['float64','401c000000000000']"),new byte[]{(byte)0xff}})
            assertNull(NativeOriginalBrowserQueuePayload.inspectOriginalRow(bad,bytes(tag(row(args)).toString())));
        assertNull(NativeOriginalBrowserQueuePayload.inspectOriginalRow(bytes(number(7).toString()),new byte[8388609]));
        JSONObject deep=arguments();Object nested="x";for(int i=0;i<65;i++)nested=new JSONArray().put(nested);deep.put("nested",nested);
        assertNull(inspect(row(deep))); // Existing parser16/10000 is NOT widened.
    }
    @Test public void ROWINDEX_safeNumbersAndOriginalIdentityChecks()throws Exception{
        JSONObject args=arguments();
        for(double key:new double[]{-0.0,0,-1,7.5,9007199254740992d,Double.NaN,Double.POSITIVE_INFINITY})
            assertNull(NativeOriginalBrowserQueuePayload.inspectOriginalRow(bytes(number(key).toString()),bytes(tag(row(args).put("id",0)).toString())));
        for(Object version:new Object[]{0,7,1.5,"6"})assertNull(inspect(row(args).put("schema_version",version)));
        assertNull(inspect(row(args).put("id",8)));assertNull(inspect(row(args).put("operation_id","unbound")));
        assertNull(inspect(row(arguments().put("p_native_finish_scan_entry_id",JSONObject.NULL))));
        try(var indexed=NativeOriginalBrowserQueuePayload.inspectOriginalRow(bytes(number(9007199254740991d).toString()),bytes(tag(row(args).put("id",9007199254740991L)).toString()))){
            assertNotNull(indexed);assertEquals(9007199254740991L,indexed.primaryId);
        }
    }
    @Test public void ROWINDEX_argumentBoundsStrictnessAndNonCoercion()throws Exception{
        JSONObject args=arguments().put("n",7);try(var indexed=inspect(row(args))){
            assertNotNull(indexed);assertEquals(MATCH,indexed.matchOriginalArgument(bytes(args.toString().replace("\"n\":7","\"n\":7.0"))));
            for(byte[] bad:new byte[][]{null,new byte[0],new byte[262145],bytes("{}"),bytes("{\"n\":-0}"),
                bytes(args.toString().replace("\"n\":7","\"n\":9007199254740993")),bytes(args.toString()+" null"),
                bytes(args.toString().replace("\"n\":7","\"n\":\"7\"")),bytes("{\"x\":\"\\ud800\"}")})
                assertEquals(HELD,indexed.matchOriginalArgument(bad));
            assertEquals(MATCH,indexed.matchOriginalArgument(bytes(args.toString())));
        }
    }
    @Test public void ROWINDEX_privateConstructionNoRawGetterOrAuthority()throws Exception{
        var type=NativeOriginalBrowserQueuePayload.OriginalQueueRow.class;
        assertTrue(java.lang.reflect.Modifier.isFinal(type.getModifiers()));assertEquals(1,type.getDeclaredConstructors().length);
        assertTrue(java.lang.reflect.Modifier.isPrivate(type.getDeclaredConstructors()[0].getModifiers()));
        for(String field:new String[]{"primaryId","operationId","deviceId","clientSessionId","clientCompletionId"}){
            int flags=type.getDeclaredField(field).getModifiers();assertTrue(java.lang.reflect.Modifier.isFinal(flags));
            assertFalse(java.lang.reflect.Modifier.isPublic(flags));
        }
        assertTrue(java.lang.reflect.Modifier.isPrivate(type.getDeclaredField("payload").getModifiers()));
        var methods=new java.util.HashSet<String>();for(var method:type.getDeclaredMethods())methods.add(method.getName());
        assertEquals(java.util.Set.of("matchOriginalArgument","close"),methods);
        assertTrue(java.lang.reflect.Modifier.isSynchronized(type.getDeclaredMethod("matchOriginalArgument",byte[].class).getModifiers()));
        assertTrue(java.lang.reflect.Modifier.isSynchronized(type.getDeclaredMethod("close").getModifiers()));
    }
    // WHOLE_ROW_TESTS_END

    @Test public void PAYLOAD_directExactTaggedVectorAndTypes()throws Exception{
        JSONObject args=arguments().put("text","snowman \u2603 / quote \" backslash \\")
            .put("flag",true).put("empty",JSONObject.NULL).put("ordered",new JSONArray().put(7).put(0.125).put(false));
        assertEquals(MATCH,match(row(args),args));
        // Explicit independent big-endian IEEE64 key, not a row/hash echo.
        assertEquals(MATCH,NativeOriginalBrowserQueuePayload.matchOriginalPayload(bytes("[\"float64\",\"401c000000000000\"]"),
            bytes(tag(row(arguments())).toString()),bytes(arguments().toString())));
    }
    @Test public void PAYLOAD_forwardAndVersions()throws Exception{
        for(int version=1;version<=6;version++){
            JSONObject args=arguments(),r=row(args).put("schema_version",version);
            assertEquals(MATCH,match(r,args));r.put("type","forward-replay-fenced:commit_workflow")
                .put("forward_action_type","commit_workflow").put("forward_replay_contract","scan.v4.snapshot-bound-authority");
            assertEquals(MATCH,match(r,args));r.put("forward_action_type","start_workflow");assertEquals(HELD,match(r,args));
            r.put("forward_action_type","commit_workflow").put("forward_replay_contract","other");assertEquals(HELD,match(r,args));
        }
    }
    @Test public void PAYLOAD_changedOrExtraPayloadRetained()throws Exception{
        JSONObject args=arguments().put("steps",new JSONArray().put("a").put("b")),r=row(args);
        assertEquals(HELD,match(r,new JSONObject(args.toString()).put("extra",false)));
        assertEquals(HELD,match(r,new JSONObject(args.toString()).put("steps",new JSONArray().put("b").put("a"))));
        JSONObject less=new JSONObject(args.toString());less.remove("steps");assertEquals(HELD,match(r,less));
        assertEquals(HELD,match(r,new JSONObject(args.toString()).put("steps","a,b")));
    }
    @Test public void PAYLOAD_originalRowIdentityAndShape()throws Exception{
        JSONObject args=arguments();
        for(Object id:new Object[]{8,"7",JSONObject.NULL})assertEquals(HELD,match(row(args).put("id",id),args));
        for(Object version:new Object[]{0,7,1.5,"6"})assertEquals(HELD,match(row(args).put("schema_version",version),args));
        for(String type:new String[]{"start_workflow","forward-replay-fenced:other","commit_workflow "})assertEquals(HELD,match(row(args).put("type",type),args));
        assertEquals(HELD,match(row(args).put("payload",new JSONArray()),args));
        assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(bytes("[\"float64\",\"0000000000000000\"]"),bytes(tag(row(args)).toString()),bytes(args.toString())));
        assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(bytes("[\"string\",\"7\"]"),bytes(tag(row(args)).toString()),bytes(args.toString())));
    }
    @Test public void PAYLOAD_uuidDeviceAndCompletionBinding()throws Exception{
        for(String name:new String[]{"p_client_session_id","p_client_completion_id","p_native_finish_scan_entry_id"}){
            JSONObject args=arguments().put(name,"00000000-0000-0000-0000-000000000000");assertEquals(HELD,match(row(args),args));
        }
        for(String device:new String[]{"", "kiosk_08", "K".repeat(65), "KIOSK 08"}){JSONObject args=arguments().put("p_device_id",device);assertEquals(HELD,match(row(args),args));}
        JSONObject args=arguments();assertEquals(HELD,match(row(args).put("operation_id",OPERATION.toUpperCase().replace("44444444","AAAAAAAA")),args));
        assertEquals(MATCH,match(row(args).put("completion_client_id",JSONObject.NULL),args));
        assertEquals(MATCH,match(row(args).put("completion_client_id",COMPLETION),args));
        assertEquals(HELD,match(row(args).put("completion_client_id",SESSION),args));
    }
    @Test public void PAYLOAD_safeIeeeIdentityNotNumericCoercion()throws Exception{
        for(double n:new double[]{7.0,0.125,-2.5,9007199254740991d,-9007199254740991d}){
            JSONObject args=arguments().put("n",n);assertEquals(MATCH,match(row(args),args));
        }
        JSONObject args=arguments().put("n",7);JSONArray original=tag(row(args));
        assertEquals(MATCH,tagged(original,args.toString().replace("\"n\":7","\"n\":7.0")));
        assertEquals(MATCH,tagged(original,args.toString().replace("\"n\":7","\"n\":7e0")));
        assertEquals(HELD,tagged(original,args.toString().replace("\"n\":7","\"n\":7.000000000000001")));
        assertEquals(HELD,match(row(args),new JSONObject(args.toString()).put("n","7")));
    }
    @Test public void PAYLOAD_negativeZeroAndUnsafeNumbersRetained()throws Exception{
        JSONObject args=arguments().put("n",0);JSONArray original=tag(row(args));String text=args.toString();
        for(String token:new String[]{"-0","-0.0","-0e0","9007199254740992","9007199254740993",
            "9007199254740991.1","1e999","1e-999"})assertEquals(token,HELD,tagged(original,text.replace("\"n\":0","\"n\":"+token)));
        JSONArray payload=tag(args);replace(payload,"n",number(-0.0));JSONArray r=tag(row(args));replace(r,"payload",payload);
        assertEquals(HELD,tagged(r,text));
        for(double n:new double[]{Double.NaN,Double.POSITIVE_INFINITY,9007199254740992d}){replace(payload,"n",number(n));assertEquals(HELD,tagged(r,text));}
        // Number-looking string DATA is not scanned as a numeric token.
        args.put("n","-0 9007199254740993 \"escaped\"");assertEquals(MATCH,match(row(args),args));
    }
    @Test public void PAYLOAD_duplicateKeysRetained()throws Exception{
        JSONObject args=arguments();JSONArray r=tag(row(args)),payload=tag(args);
        pairs(payload).put(new JSONArray().put("p_device_id").put(new JSONArray().put("string").put("KIOSK_08")));
        replace(r,"payload",payload);assertEquals(HELD,tagged(r,args.toString()));
        r=tag(row(args));pairs(r).put(new JSONArray().put("id").put(number(7)));assertEquals(HELD,tagged(r,args.toString()));
        String duplicate=args.toString().replace("{","{\"p_device_id\":\"KIOSK_08\",");assertEquals(HELD,tagged(tag(row(args)),duplicate));
        String escapedDuplicate=args.toString().replace("{","{\"\\u0070_device_id\":\"KIOSK_08\",");assertEquals(HELD,tagged(tag(row(args)),escapedDuplicate));
    }
    @Test public void PAYLOAD_unsupportedTagsAndArityRetained()throws Exception{
        JSONObject args=arguments();
        for(String kind:new String[]{"date","undefined","hole","binary","object-unknown"}){
            JSONArray r=tag(row(args)),payload=tag(args);pairs(payload).put(new JSONArray().put("extra").put(new JSONArray().put(kind)));
            replace(r,"payload",payload);assertEquals(HELD,tagged(r,args.toString()));
        }
        for(JSONArray bad:new JSONArray[]{new JSONArray().put("null").put(0),new JSONArray().put("boolean").put("false"),
            new JSONArray().put("float64").put("401C000000000000"),new JSONArray().put("string"),new JSONArray().put("array").put("not-items")}){
            JSONArray r=tag(row(args));replace(r,"payload",bad);assertEquals(HELD,tagged(r,args.toString()));
        }
    }
    @Test public void PAYLOAD_strictJsonUtf8AndSurrogates()throws Exception{
        JSONObject args=arguments();byte[] key=bytes(number(7).toString()),value=bytes(tag(row(args)).toString());
        for(String bad:new String[]{"{'p_device_id':'KIOSK_08'}",args.toString()+"null", "\ufeff"+args,"{\"n\":01}","{\"n\":\"\\ud800\"}"})
            assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(key,value,bytes(bad)));
        assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(key,value,new byte[]{(byte)0xc3,0x28}));
        assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(key,bytes("[\"object\",[[\"\\ud800\",[\"null\"]]]]"),bytes(args.toString())));
        for(byte[] bad:new byte[][]{null,new byte[0],bytes("{}"),bytes("[\"float64\",\"7\"]")})
            assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(bad,value,bytes(args.toString())));
    }
    @Test public void PAYLOAD_sizeDepthAndParserCeilingsRetained()throws Exception{
        JSONObject args=arguments();byte[] key=bytes(number(7).toString()),value=bytes(tag(row(args)).toString()),raw=bytes(args.toString());
        assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(new byte[8*1024*1024+1],value,raw));
        assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(key,new byte[8*1024*1024+1],raw));
        assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(key,value,new byte[262145]));
        JSONObject deep=arguments();Object nested="x";for(int i=0;i<65;i++)nested=new JSONArray().put(nested);deep.put("deep",nested);
        assertEquals(HELD,match(row(deep),deep));
        JSONArray many=new JSONArray();for(int i=0;i<10001;i++)many.put(true);JSONObject crowded=arguments().put("many",many);
        assertEquals(HELD,match(row(crowded),crowded));
        String spaced=" ".repeat(262144-raw.length)+args;assertEquals(MATCH,NativeOriginalBrowserQueuePayload.matchOriginalPayload(key,value,bytes(spaced)));
    }
    @Test public void PAYLOAD_callerArraysPreservedAndDataOnlyState()throws Exception{
        JSONObject args=arguments();byte[] key=bytes(number(7).toString()),value=bytes(tag(row(args)).toString()),raw=bytes(args.toString());
        byte[] k=key.clone(),v=value.clone(),r=raw.clone();assertEquals(MATCH,NativeOriginalBrowserQueuePayload.matchOriginalPayload(key,value,raw));
        assertArrayEquals(k,key);assertArrayEquals(v,value);assertArrayEquals(r,raw);
        raw[0]='!';byte[] malformed=raw.clone();assertEquals(HELD,NativeOriginalBrowserQueuePayload.matchOriginalPayload(key,value,raw));
        assertArrayEquals(k,key);assertArrayEquals(v,value);assertArrayEquals(malformed,raw);
        assertEquals(2,NativeOriginalBrowserQueuePayload.State.values().length);
        assertEquals("MATCHED_ORIGINAL_PAYLOAD_NOT_AUTHORITY",MATCH.name());assertEquals("UNRESOLVED_RETAINED",HELD.name());
        Arrays.fill(k,(byte)0);Arrays.fill(v,(byte)0);Arrays.fill(r,(byte)0);Arrays.fill(malformed,(byte)0);
    }
}
