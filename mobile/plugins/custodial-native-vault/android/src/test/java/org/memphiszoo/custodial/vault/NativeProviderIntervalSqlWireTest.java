package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual SQL fresh response bytes -> native typed transport -> conditional
 * interval. Profile/counter inputs remain SYNTHETIC, not device qualification. */
public final class NativeProviderIntervalSqlWireTest {
    private JSONObject fixture()throws Exception {
        String path=System.getenv("NATIVE_PROVIDER_EVENTS_FIXTURE");assertNotNull("actual SQL fixture required",path);
        return new JSONObject(new String(Files.readAllBytes(Path.of(path)),StandardCharsets.UTF_8));
    }
    private NativeProviderInventory.Request request(JSONObject fixture,String name)throws Exception {
        JSONObject body=fixture.getJSONObject("interval").getJSONObject(name),scan=new JSONObject().put("captured_epoch",0).put("pages",name.equals("input")?0:1);
        for(String field:new String[]{"scan_id","generation_ids","cursor","ceiling","server_now"})scan.put(field,body.get(field));
        return new NativeProviderInventory.Request(NativeProviderPrincipal.fromNativeJournal(fixture.getJSONObject("nativePrincipal")),0,"synthetic-interval-wire",scan);
    }
    private NativeProviderClockExchange exchange(NativeProviderInventory.Request request,JSONObject response,String nonce,long a,long b)throws Exception {
        String hash=NativeProviderPrincipal.hash(new String(request.body(),StandardCharsets.UTF_8));
        return new NativeProviderClockExchange(new AuthorizedResponse(200,Map.of("Content-Type","application/json"),response.toString().getBytes(StandardCharsets.UTF_8)),
            nonce,"/employee-notifications-api/native-provider/inventory",hash,new NativeProviderClockExchange.Point(a,7),new NativeProviderClockExchange.Point(b,7));
    }
    @Test public void actualSqlClockAndFrozenPageAreSeparateAcrossPaginationAndLoss()throws Exception {
        JSONObject f=fixture(),i=f.getJSONObject("interval");
        NativeProviderInventory.Request first=request(f,"input"),next=request(f,"next");
        NativeProviderInventory.CheckedExchange one=NativeProviderInventory.validateExchange(first,exchange(first,i.getJSONObject("first"),i.getString("firstNonce"),100,112));
        NativeProviderInventory.CheckedExchange two=NativeProviderInventory.validateExchange(next,exchange(next,i.getJSONObject("second"),i.getString("secondNonce"),1100,1112));
        assertEquals(one.page.data().get("server_now"),two.page.data().get("server_now"));assertTrue(two.clock.serverMicros>one.clock.serverMicros);
        assertNotEquals(NativeProviderClockExchange.micros(one.page.data().get("server_now")),one.clock.serverMicros);
        NativeProviderTime.Platform platform=NativeProviderTimeTest.platform();NativeProviderClockExchange.Point now=new NativeProviderClockExchange.Point(112,7);
        assertNull(NativeProviderTime.observe(one.clock,NativeProviderTime.Profiles.NONE.select(platform),platform,now));
        NativeProviderTime.Bounds bounds=NativeProviderTime.observe(one.clock,NativeProviderTimeTest.profile(1_000_000,10000,900_000_000_000L),platform,now);
        assertNotNull(bounds);assertTrue(bounds.earliestMicros<=one.clock.serverMicros&&bounds.latestMicros>=one.clock.serverMicros);
        assertTrue(ProviderWireJson.same(i.getJSONObject("first").getJSONObject("data"),i.getJSONObject("replay").getJSONObject("data")));
    }
    @Test public void sqlEnvelopeCannotBeReboundToWrongNonceBodyFrozenTimeOrExtraAuthority()throws Exception {
        JSONObject f=fixture(),i=f.getJSONObject("interval");NativeProviderInventory.Request request=request(f,"input");
        for(String fault:new String[]{"nonce","missing","extra","body","frozen","point"}){
            JSONObject response=new JSONObject(i.getJSONObject("first").toString());String nonce=i.getString("firstNonce");
            if(fault.equals("nonce"))nonce=i.getString("secondNonce");
            if(fault.equals("missing"))response.remove("clock");
            if(fault.equals("extra"))response.getJSONObject("clock").put("qualified",true);
            if(fault.equals("frozen"))response.getJSONObject("clock").put("server_now",NativeProviderTime.canonical(NativeProviderClockExchange.micros(response.getJSONObject("data").get("server_now"))-1L));
            if(fault.equals("point"))response.getJSONObject("clock").put("authenticated_at",response.getJSONObject("clock").get("server_now"));
            NativeProviderClockExchange x=exchange(request,response,nonce,100,112);
            if(fault.equals("body"))x=new NativeProviderClockExchange(x.response,x.requestId,x.path,"f".repeat(64),x.before,x.after);
            try{NativeProviderInventory.validateExchange(request,x);fail(fault);}catch(VaultFailure rejected){assertTrue(rejected.code.startsWith("custodial_provider_"));}
        }
    }
    @Test public void actualRawHmacHttpSqlEnvelopeUsesSameStrictNativeValidator()throws Exception {
        JSONObject f=fixture(),response=f.getJSONObject("interval").getJSONObject("http_response");
        NativeProviderInventory.Request request=request(f,"input");
        NativeProviderInventory.CheckedExchange checked=NativeProviderInventory.validateExchange(request,
            exchange(request,response,response.getJSONObject("clock").getString("native_request_id"),100,112));
        assertEquals(NativeProviderClockExchange.micros(f.getJSONObject("interval").getJSONObject("first").getJSONObject("data").get("server_now"))+4_000_000L,checked.clock.serverMicros);
        assertEquals(f.getJSONObject("interval").getJSONObject("first").getJSONObject("data").get("server_now"),checked.page.data().get("server_now"));
    }
}
