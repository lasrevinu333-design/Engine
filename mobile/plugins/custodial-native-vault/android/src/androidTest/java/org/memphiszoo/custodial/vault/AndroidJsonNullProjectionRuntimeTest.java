package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.os.Build;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Actual Android JSON DATA projection only. No HTTP, enrollment, Engine,
 * credential/key/session access, file mutation, authority, ACK or send. */
@RunWith(AndroidJUnit4.class)
public final class AndroidJsonNullProjectionRuntimeTest {
    private static void actualIsolatedAndroidJson() {
        var app=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("disposable instrumentation app only",app.getPackageName().endsWith(".test"));
        assertTrue("managed emulator only, never a phone",Build.FINGERPRINT.contains("generic")
            ||(Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE)));
        assertTrue("pinned official API35/36 JSON source family",Build.VERSION.SDK_INT==35||Build.VERSION.SDK_INT==36);
        assertSame(Object.class.getClassLoader(),JSONObject.class.getClassLoader());
        assertSame(Object.class.getClassLoader(),JSONArray.class.getClassLoader());
    }
    private static void explicitNull(JSONObject object,String key)throws Exception {
        assertTrue("explicit null field was dropped: "+key,object.has(key));
        assertSame(JSONObject.NULL,object.get(key));
    }
    private static void messageNulls(JSONObject object)throws Exception {
        assertEquals("synthetic-message",object.getString("id"));
        for(String key:new String[]{"deleted_at","deleted_by_user_id","purge_after"})explicitNull(object,key);
        assertEquals(4,object.length());
    }
    @Test public void bootstrapAndroidMapAndCollectionKeepExplicitNulls()throws Exception {
        actualIsolatedAndroidJson();assertSame(JSONObject.NULL,JSONObject.wrap(null));
        Map<String,Object> nested=new LinkedHashMap<>();nested.put("nested_null",null);
        Map<String,Object> values=new LinkedHashMap<>();values.put("nullable",null);values.put("nested",nested);
        values.put("array",Arrays.asList(null,nested,"null"));
        var object=new JSONObject(values);explicitNull(object,"nullable");explicitNull(object.getJSONObject("nested"),"nested_null");
        var array=object.getJSONArray("array");assertEquals(3,array.length());assertSame(JSONObject.NULL,array.get(0));
        explicitNull(array.getJSONObject(1),"nested_null");assertEquals("null",array.getString(2));
        var roundTrip=new JSONObject(object.toString());explicitNull(roundTrip,"nullable");
        explicitNull(roundTrip.getJSONArray("array").getJSONObject(1),"nested_null");
        System.out.println("UNIT_ANDROID_JSON_MAP_NULLS; actual bootstrap JSON DATA only; no authority or native MESSAGE effect");
    }
    @Test public void actualScrubberKeepsMessageAndArrayNullsWhileRemovingSyntheticSecrets()throws Exception {
        actualIsolatedAndroidJson();char[] secret="SYNTHETIC_JSON_NULL_PROJECTION_ONLY".toCharArray();
        byte[] raw="""
            {"ok":true,"data":{"id":"synthetic-message","deleted_at":null,"deleted_by_user_id":null,"purge_after":null},
             "meta":{"outcome":{"result":{"id":"synthetic-message","deleted_at":null,"deleted_by_user_id":null,"purge_after":null}}},
             "array":[null,{"nullable":null},"null"],"token":"SYNTHETIC_JSON_NULL_PROJECTION_ONLY",
             "echo":"SYNTHETIC_JSON_NULL_PROJECTION_ONLY"}
            """.getBytes(StandardCharsets.UTF_8);
        byte[] safe=null,arrayRaw=null,arraySafe=null;
        try{
            safe=HttpsEnrollmentTransport.scrubResponseBody(raw,"application/json",secret);
            var result=new JSONObject(new String(safe,StandardCharsets.UTF_8));assertTrue(result.getBoolean("ok"));
            messageNulls(result.getJSONObject("data"));messageNulls(result.getJSONObject("meta").getJSONObject("outcome").getJSONObject("result"));
            var array=result.getJSONArray("array");assertEquals(3,array.length());assertSame(JSONObject.NULL,array.get(0));
            explicitNull(array.getJSONObject(1),"nullable");assertEquals("null",array.getString(2));
            assertFalse(result.has("token"));explicitNull(result,"echo");
            assertFalse(new String(safe,StandardCharsets.UTF_8).contains(new String(secret)));
            arrayRaw="[null,{\"nullable\":null},[null]]".getBytes(StandardCharsets.UTF_8);
            arraySafe=HttpsEnrollmentTransport.scrubResponseBody(arrayRaw,"application/json",null);
            var rootArray=new JSONArray(new String(arraySafe,StandardCharsets.UTF_8));assertEquals(3,rootArray.length());
            assertSame(JSONObject.NULL,rootArray.get(0));explicitNull(rootArray.getJSONObject(1),"nullable");
            assertSame(JSONObject.NULL,rootArray.getJSONArray(2).get(0));
        }finally{
            Arrays.fill(secret,'\0');Arrays.fill(raw,(byte)0);if(safe!=null)Arrays.fill(safe,(byte)0);
            if(arrayRaw!=null)Arrays.fill(arrayRaw,(byte)0);if(arraySafe!=null)Arrays.fill(arraySafe,(byte)0);
        }
        System.out.println("UNIT_ANDROID_RESPONSE_SCRUB_NULLS; unchanged production scrubber retains explicit nulls and removes synthetic secrets; no HTTP or effects");
    }
}
