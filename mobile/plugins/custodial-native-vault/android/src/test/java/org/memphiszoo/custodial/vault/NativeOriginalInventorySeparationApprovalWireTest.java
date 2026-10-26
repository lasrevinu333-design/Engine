package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** Only synthetic receipt/manager DATA. No private issuer, signed session,
 * SQL transaction, genuine manager, inventory ACK or finalizer is exercised. */
public final class NativeOriginalInventorySeparationApprovalWireTest {
    private static final String[] EFFECTS={"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"};
    private static final String[] TARGET={"operation_id","separation_id","separation_authority_revision","canonical_device_pk","canonical_device_id",
        "employee_id","credential_id","assignment_epoch","original_generation_id","original_credential_secret_key_id","principal_digest",
        "engine_revision","original_wire_sha256","original_frozen_work_sha256","capsule_sha256","record_sha256","frame_sha256","plan_sha256",
        "aad_binding_sha256","source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256"};
    private static final Set<String> UUID_TARGET=Set.of("operation_id","separation_id","canonical_device_pk","employee_id","credential_id","original_generation_id");
    public static void main(String[] args)throws Exception {
        if(args.length!=2||!"--inventory-approval-wire-only".equals(args[0])||!Set.of(
            "APPROVAL_ownedDetachedCloseAndRawHashBoundary","APPROVAL_allOriginalTargetAndParentPins",
            "APPROVAL_closedManagerCommandAndIssuer","APPROVAL_closedReceiptWrapperAndEffects",
            "APPROVAL_canonicalFiniteLifetime","APPROVAL_strictParserTypesAndBounds",
            "APPROVAL_expectedInputsAndNoAuthority","CURRENT_exactMicrosecondBoundaries",
            "CURRENT_monotonicAndWallClockMaximum","CURRENT_backwardNegativeOverflowAndYearBounds",
            "CURRENT_calendarEpochConversions","CURRENT_ownedCopiesClosedAndForeign").contains(args[1]))throw new IllegalArgumentException("Select one new approval DATA member");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeOriginalInventorySeparationApprovalWireTest.class,args[1]));
        for(var failure:result.getFailures())System.err.println(failure.getTrace());
        if(!result.wasSuccessful()||result.getRunCount()!=1)throw new AssertionError("New approval DATA member failed");
        System.out.println("PASS_UNTRUSTED_APPROVAL_DATA_ONLY "+args[1]);
        System.out.println("NO_AUTHENTICATION_CURRENT_MANAGER_SQL_NATIVE_ACK_FINALIZER_OR_KEY_PROOF");
    }
    @Test public void APPROVAL_ownedDetachedCloseAndRawHashBoundary()throws Exception {
        Fixture f=new Fixture();byte[] target=f.targetBytes(),response=f.response(),a=target.clone(),b=response.clone();
        var decoded=decode(f,target,200,response);
        assertArrayEquals(a,target);assertArrayEquals(b,response);
        Arrays.fill(target,(byte)0);Arrays.fill(response,(byte)0);
        JSONObject first=decoded.json();assertEquals(15,first.length());
        first.getJSONObject("issuer").put("manager_id",uuid('f'));
        first.getJSONObject("original_request").put("decision","WRONG");
        first.getJSONObject("limits").put("key_removal",true);
        assertEquals(f.receipt.getJSONObject("issuer").get("manager_id"),decoded.json().getJSONObject("issuer").get("manager_id"));
        assertEquals(Boolean.FALSE,decoded.json().getJSONObject("limits").get("key_removal"));
        // Read-only DATA buffer seam: verify close wipes owned bytes, not authority.
        var field=decoded.getClass().getDeclaredField("fields");field.setAccessible(true);
        byte[] owned=(byte[])field.get(decoded);assertTrue(owned.length>0);
        decoded.close();assertTrue(Arrays.equals(new byte[owned.length],owned));
        assertNull(field.get(decoded));decoded.close();
        try{decoded.json();fail("closed DATA result");}catch(VaultFailure failure){assertEquals(NativeOriginalInventorySeparationApprovalWire.FAILURE,failure.code);}
        // Exact manager raw UTF8 is absent. Shape-valid arbitrary hashes remain
        // UNTRUSTED: serialization/digest recomputation here would be dishonest.
        for(String hash:new String[]{hex('0'),hex('f')}){Fixture g=new Fixture();g.receipt.put("original_request_sha256",hash).put("receipt_sha256",hash);accepted(g);}
    }
    @Test public void APPROVAL_allOriginalTargetAndParentPins()throws Exception {
        for(String key:TARGET){
            Fixture f=new Fixture();JSONObject actual=f.receipt.getJSONObject("original_target");
            actual.put(key,UUID_TARGET.contains(key)?uuid('f'):key.equals("canonical_device_id")?"KIOSK_10":
                Set.of("assignment_epoch","engine_revision","separation_authority_revision").contains(key)?"2":hex('f'));denied(f);
        }
        Fixture parent=new Fixture();parent.command.put("native_request_id",uuid('e'));denied(parent);
        for(String key:new String[]{"inventory_manifest_sha256","registration_receipt_sha256"}){
            Fixture f=new Fixture();f.receipt.put(key,hex('e'));denied(f);
            Fixture g=new Fixture();g.command.put("expected_"+key,hex('e'));denied(g);
        }
        Fixture revision=new Fixture();revision.command.put("expected_separation_authority_revision","2");denied(revision);
        for(String key:TARGET){
            Fixture f=new Fixture();f.target.remove(key);denied(f);
        }
        Fixture extra=new Fixture();extra.target.put("unknown","retained");denied(extra);
        Fixture targetFloat=new Fixture();targetFloat.target.put("assignment_epoch",1.0);denied(targetFloat);
        Fixture targetOverflow=new Fixture();targetOverflow.target.put("engine_revision","9007199254740992");denied(targetOverflow);
    }
    @Test public void APPROVAL_closedManagerCommandAndIssuer()throws Exception {
        Fixture base=new Fixture();
        for(var it=base.command.keys();it.hasNext();){Fixture f=new Fixture();f.command.remove(it.next());denied(f);}
        for(String key:new String[]{"schema","decision","manager_confirmation"}){
            Fixture f=new Fixture();f.command.put(key,"AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION");denied(f);
        }
        for(String key:new String[]{"request_id","native_request_id","expected_manager_id","expected_manager_credential_id"}){
            Fixture f=new Fixture();f.command.put(key,"aaaaaaaa-aaaa-6aaa-8aaa-aaaaaaaaaaaa");denied(f);
        }
        for(String key:new String[]{"manager_id","manager_credential_id","manager_device_id"}){
            Fixture f=new Fixture();f.receipt.getJSONObject("issuer").put(key,key.equals("manager_device_id")?"foreign-manager-device":uuid('f'));denied(f);
            Fixture g=new Fixture();g.command.put("expected_"+key,key.equals("manager_device_id")?"foreign-manager-device":uuid('f'));denied(g);
            Fixture missing=new Fixture();missing.receipt.getJSONObject("issuer").remove(key);denied(missing);
        }
        Fixture extra=new Fixture();extra.command.put("work_accepted",true);denied(extra);
        Fixture issuerExtra=new Fixture();issuerExtra.receipt.getJSONObject("issuer").put("can_authorize",true);denied(issuerExtra);
        Fixture device=new Fixture();device.command.put("expected_manager_device_id","x".repeat(129));denied(device);
        Fixture devicePath=new Fixture();devicePath.command.put("expected_manager_device_id","/foreign");denied(devicePath);
        Fixture upper=new Fixture();upper.command.put("expected_review_sha256",hex('A'));denied(upper);
        for(Object wrong:new Object[]{1,1.0,true,JSONObject.NULL,new JSONObject()}){
            Fixture f=new Fixture();f.command.put("expected_review_sha256",wrong);denied(f);
        }
    }
    @Test public void APPROVAL_closedReceiptWrapperAndEffects()throws Exception {
        Fixture base=new Fixture();
        for(var it=base.receipt.keys();it.hasNext();){Fixture f=new Fixture();f.receipt.remove(it.next());denied(f);}
        for(String key:new String[]{"schema","state","purpose_admission_id"}){
            Fixture f=new Fixture();f.receipt.put(key,"COMPLETE");denied(f);
        }
        Fixture retry=new Fixture();retry.receipt.put("retry_safe",true);denied(retry);
        Fixture extra=new Fixture();extra.receipt.put("transaction_authority",true);denied(extra);
        for(String key:EFFECTS){
            Fixture f=new Fixture();JSONObject limits=f.receipt.getJSONObject("limits");limits.put(key,!limits.getBoolean(key));denied(f);
            Fixture missing=new Fixture();missing.receipt.getJSONObject("limits").remove(key);denied(missing);
            for(Object wrong:new Object[]{"false","true",0L,1.0,JSONObject.NULL}){
                Fixture g=new Fixture();g.receipt.getJSONObject("limits").put(key,wrong);denied(g);
            }
        }
        Fixture extraFlag=new Fixture();extraFlag.receipt.getJSONObject("limits").put("phone_ready",false);denied(extraFlag);
        for(int status:new int[]{0,201,204,302,400,401,403,409,500})denied(base,base.targetBytes(),status,base.response());
        for(Object ok:new Object[]{false,"true",1.0,JSONObject.NULL})denied(base,base.targetBytes(),200,bytes(new JSONObject().put("ok",ok).put("data",base.receipt).toString()));
        denied(base,base.targetBytes(),200,bytes(new JSONObject().put("ok",true).put("data",base.receipt).put("state","COMPLETE").toString()));
        denied(base,base.targetBytes(),200,bytes(new JSONObject().put("ok",true).put("data","COMPLETE").toString()));
    }
    @Test public void APPROVAL_canonicalFiniteLifetime()throws Exception {
        Fixture f=new Fixture();f.receipt.put("expires_at","2026-10-16T12:05:00.000001Z");denied(f);
        f.receipt.put("expires_at","2026-10-16T12:05:00.000000Z");accepted(f);
        f.receipt.put("expires_at","2026-10-16T12:00:00.000001Z");accepted(f);
        f.receipt.put("expires_at",f.receipt.get("approved_at"));denied(f);
        f.receipt.put("expires_at","2026-10-16T11:59:59.999999Z");denied(f);
        for(String bad:new String[]{"infinity","-infinity","0000-01-01T00:00:00.000000Z",
            "2100-02-29T12:00:00.000000Z","2026-04-31T12:00:00.000000Z","2026-10-16T24:00:00.000000Z",
            "2026-10-16T12:60:00.000000Z","2026-10-16T12:00:60.000000Z","2026-10-16T12:00:00.000Z",
            "2026-10-16T12:00:00.000000+00:00","2026-10-16T12:00:00.0000000Z"}){
            Fixture g=new Fixture();g.receipt.put("approved_at",bad);denied(g);
            Fixture h=new Fixture();h.receipt.put("expires_at",bad);denied(h);
        }
        for(String[] pair:new String[][]{{"0001-01-01T00:00:00.000000Z","0001-01-01T00:05:00.000000Z"},
            {"9999-12-31T23:54:59.999999Z","9999-12-31T23:59:59.999999Z"},
            {"2000-02-29T23:59:59.999999Z","2000-03-01T00:00:00.000000Z"}}){
            Fixture g=new Fixture();g.receipt.put("approved_at",pair[0]).put("expires_at",pair[1]);accepted(g);
        }
    }
    @Test public void APPROVAL_strictParserTypesAndBounds()throws Exception {
        Fixture f=new Fixture();
        for(String text:new String[]{"[]","null","{ok:true}","{'ok':true}",new String(f.response(),StandardCharsets.UTF_8)+" false",
            "{\"ok\":true,\"ok\":true,\"data\":"+f.receipt+"}",
            "{\"ok\":true,\"data\":{\"schema\":\"duplicate\","+f.receipt.toString().substring(1)+"}",
            new String(f.response(),StandardCharsets.UTF_8).replace("\"manager_id\":","\"manager_id\":\"duplicate\",\"manager_id\":"),
            new String(f.response(),StandardCharsets.UTF_8).replace("\"request_id\":","\"request_id\":\"duplicate\",\"request_id\":"),
            new String(f.response(),StandardCharsets.UTF_8).replace("\"key_removal\":false","\"key_removal\":false,\"key_removal\":false"),
            new String(f.response(),StandardCharsets.UTF_8).replace("synthetic-manager-device","\\ud800")}){
            denied(f,f.targetBytes(),200,bytes(text));
        }
        denied(f,f.targetBytes(),200,new byte[]{'{','"',(byte)0xc3,(byte)0x28,'"',':','1','}'});
        denied(f,new byte[]{(byte)0xff},200,f.response());
        denied(f,bytes("{\"operation_id\":\"duplicate\","+f.target.toString().substring(1)),200,f.response());
        denied(f,f.targetBytes(),200,new byte[NativeOriginalInventorySeparationApprovalWire.MAX_RESPONSE+1]);
        denied(f,new byte[NativeOriginalInventorySeparationApprovalWire.MAX_TARGET+1],200,f.response());
        try(var data=decode(f,pad(f.targetBytes(),NativeOriginalInventorySeparationApprovalWire.MAX_TARGET),200,
            pad(f.response(),NativeOriginalInventorySeparationApprovalWire.MAX_RESPONSE))){assertEquals(15,data.json().length());}
    }
    @Test public void APPROVAL_expectedInputsAndNoAuthority()throws Exception {
        Fixture f=new Fixture();denied(f,null,200,f.response());denied(f,new byte[0],200,f.response());
        denied(f,f.targetBytes(),200,null);denied(f,f.targetBytes(),200,new byte[0]);
        for(String value:new String[]{null,"",uuid('a').toUpperCase(),"aaaaaaaa-aaaa-6aaa-8aaa-aaaaaaaaaaaa"}){
            f.parent=value;denied(f);
        }
        f=new Fixture();for(String value:new String[]{null,"",hex('A'),"0".repeat(63)}){
            f.manifest=value;denied(f);f.manifest=hex('c');f.registration=value;denied(f);f.registration=hex('d');
        }
        f=new Fixture();try(var data=decode(f,f.targetBytes(),200,f.response())){
            assertEquals(Boolean.TRUE,data.json().getJSONObject("limits").get("inventory_acknowledged"));
            assertEquals(Boolean.TRUE,data.json().getJSONObject("limits").get("finalizer_allowed"));
            assertFalse(data.json().has("authenticated"));assertFalse(data.json().has("current_authority"));
            assertFalse(data.json().has("native_capability"));
        }
        assertTrue(java.lang.reflect.Modifier.isPrivate(NativeOriginalInventorySeparationApprovalWire.UntrustedApproval.class.getDeclaredConstructors()[0].getModifiers()));
    }
    // NEW current-interval DATA cases only. Supplied clock observations are
    // explicitly SYNTHETIC, never genuine clock/G28 or manager authority.
    @Test public void CURRENT_exactMicrosecondBoundaries()throws Exception {
        long base=Instant.parse("2026-10-16T12:00:00.000Z").toEpochMilli();
        Fixture f=new Fixture();acceptedCurrent(f,base,0,base);
        f.receipt.put("approved_at",currentStamp(base,1));
        accepted(f); // Existing decode intentionally remains historical DATA.
        deniedCurrent(f,base,0,base);deniedCurrent(f,base,999,base);
        acceptedCurrent(f,base,1000,base);
        f.receipt.put("expires_at",currentStamp(base,2));
        acceptedCurrent(f,base,1999,base);deniedCurrent(f,base,2000,base);
        f.receipt.put("approved_at",currentStamp(base-1000,0)).put("expires_at",currentStamp(base,1));
        acceptedCurrent(f,base,0,base);deniedCurrent(f,base,1000,base);
        f.receipt.put("expires_at",currentStamp(base,0));
        accepted(f);deniedCurrent(f,base,0,base);
        f.receipt.put("expires_at",currentStamp(base-1,999));deniedCurrent(f,base,0,base);
    }
    @Test public void CURRENT_monotonicAndWallClockMaximum()throws Exception {
        long base=Instant.parse("2026-10-16T12:00:00.000Z").toEpochMilli();Fixture f=new Fixture();
        f.receipt.put("approved_at",currentStamp(base-1000,0)).put("expires_at",currentStamp(base+10,0));
        acceptedCurrent(f,base,9999999,base);deniedCurrent(f,base,10000000,base);
        // A slow/frozen wall clock cannot undo the anchored elapsed READ.
        deniedCurrent(f,base,11000000,base+1);
        // A faster observed wall clock is not replaced by a smaller anchor.
        deniedCurrent(f,base,0,base+10);acceptedCurrent(f,base,1000000,base+9);
        f.receipt.put("approved_at",currentStamp(base+2,1)).put("expires_at",currentStamp(base+20,0));
        deniedCurrent(f,base,2000000,base+2);acceptedCurrent(f,base,2001000,base+2);
    }
    @Test public void CURRENT_backwardNegativeOverflowAndYearBounds()throws Exception {
        long base=Instant.parse("2026-10-16T12:00:00.000Z").toEpochMilli();Fixture f=new Fixture();
        for(long[] bad:new long[][]{{base,0,base-1},{base,-1,base},{base,Long.MIN_VALUE,base},
            {Long.MAX_VALUE,0,Long.MAX_VALUE},{Long.MIN_VALUE,0,Long.MIN_VALUE},
            {base,Long.MAX_VALUE,base},{base,0,Long.MAX_VALUE}})deniedCurrent(f,bad[0],bad[1],bad[2]);
        long yearZero=Instant.parse("0000-01-01T00:00:00.000Z").toEpochMilli();
        deniedCurrent(f,yearZero,0,yearZero);
        long last=Instant.parse("9999-12-31T23:59:59.999Z").toEpochMilli();
        f.receipt.put("approved_at","9999-12-31T23:59:59.000000Z").put("expires_at","9999-12-31T23:59:59.999999Z");
        acceptedCurrent(f,last,998999,last);deniedCurrent(f,last,999000,last);
        deniedCurrent(f,last,1000000,last);deniedCurrent(f,last,Long.MAX_VALUE,last);
        deniedCurrent(f,last,0,last+1);
    }
    @Test public void CURRENT_calendarEpochConversions()throws Exception {
        for(String time:new String[]{"0001-01-01T00:00:00.000Z","1969-12-31T23:59:59.999Z",
            "1970-01-01T00:00:00.000Z","2000-02-29T12:00:00.123Z","2026-10-16T12:00:00.123Z",
            "9999-12-31T23:59:00.000Z"}){
            long base=Instant.parse(time).toEpochMilli();Fixture f=new Fixture();
            f.receipt.put("approved_at",currentStamp(base,0)).put("expires_at",currentStamp(base+1,0));
            acceptedCurrent(f,base,0,base);acceptedCurrent(f,base,999999,base);
            deniedCurrent(f,base,1000000,base);deniedCurrent(f,base,0,base+1);
        }
    }
    @Test public void CURRENT_ownedCopiesClosedAndForeign()throws Exception {
        long base=Instant.parse("2026-10-16T12:00:00.000Z").toEpochMilli();Fixture f=new Fixture();
        byte[] target=f.targetBytes(),response=f.response(),originalTarget=target.clone(),originalResponse=response.clone();
        var data=NativeOriginalInventorySeparationApprovalWire.decodeCurrent(target,f.parent,f.manifest,f.registration,200,response,base,0,base);
        assertArrayEquals(originalTarget,target);assertArrayEquals(originalResponse,response);
        Arrays.fill(target,(byte)0);Arrays.fill(response,(byte)0);
        data.json().put("state","CURRENT_AUTHORITY");assertEquals("INVENTORY_ACK_RECORDED_LOGICAL_SEPARATION_ONLY",data.json().get("state"));
        var field=data.getClass().getDeclaredField("fields");field.setAccessible(true);byte[] owned=(byte[])field.get(data);
        data.close();assertArrayEquals(new byte[owned.length],owned);
        try{data.json();fail("closed current DATA");}catch(VaultFailure failure){assertEquals(NativeOriginalInventorySeparationApprovalWire.FAILURE,failure.code);}
        Fixture foreign=new Fixture();foreign.receipt.getJSONObject("original_target").put("operation_id",uuid('f'));deniedCurrent(foreign,base,0,base);
        Fixture pin=new Fixture();pin.manifest=hex('f');deniedCurrent(pin,base,0,base);
        Fixture issuer=new Fixture();issuer.receipt.getJSONObject("issuer").put("manager_id",uuid('f'));deniedCurrent(issuer,base,0,base);
    }
    private static String currentStamp(long epochMillis,int additionalMicros){
        return DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSSSSS'Z'",Locale.ROOT).withZone(ZoneOffset.UTC)
            .format(Instant.ofEpochMilli(epochMillis).plusNanos(additionalMicros*1000L));
    }
    private static void acceptedCurrent(Fixture f,long start,long nanos,long observed)throws Exception{
        try(var data=NativeOriginalInventorySeparationApprovalWire.decodeCurrent(f.targetBytes(),f.parent,f.manifest,f.registration,
            200,f.response(),start,nanos,observed)){assertEquals(15,data.json().length());assertFalse(data.json().has("current_authority"));}
    }
    private static void deniedCurrent(Fixture f,long start,long nanos,long observed)throws Exception{
        byte[] target=f.targetBytes(),response=f.response(),a=target.clone(),b=response.clone();
        try(var data=NativeOriginalInventorySeparationApprovalWire.decodeCurrent(target,f.parent,f.manifest,f.registration,
            200,response,start,nanos,observed)){fail("invalid current-interval DATA accepted");}
        catch(VaultFailure failure){assertEquals(NativeOriginalInventorySeparationApprovalWire.FAILURE,failure.code);}
        assertArrayEquals(a,target);assertArrayEquals(b,response);
    }
    private static final class Fixture {
        final JSONObject target=new JSONObject(),command=new JSONObject(),receipt=new JSONObject();
        String parent=uuid('b'),manifest=hex('c'),registration=hex('d');
        Fixture()throws Exception {
            for(String key:TARGET)target.put(key,UUID_TARGET.contains(key)?uuid('a'):
                key.equals("canonical_device_id")?"KIOSK_02":key.equals("engine_revision")?"0":
                Set.of("assignment_epoch","separation_authority_revision").contains(key)?"1":hex('a'));
            command.put("schema","custodial.original-inventory-separation-request.v1").put("request_id",uuid('c'))
                .put("native_request_id",parent).put("expected_review_sha256",hex('b')).put("expected_inventory_manifest_sha256",manifest)
                .put("expected_registration_receipt_sha256",registration).put("expected_separation_authority_revision","1")
                .put("expected_manager_id",uuid('d')).put("expected_manager_credential_id",uuid('e')).put("expected_manager_device_id","synthetic-manager-device")
                .put("decision","AUTHORIZE_EXACT_ORIGINAL_RETAINED_INVENTORY_SEPARATION")
                .put("manager_confirmation","CONFIRM_LOGICAL_SEPARATION_KEEP_ALL_ORIGINAL_WORK_AND_KEYS");
            JSONObject limits=new JSONObject();for(String key:EFFECTS)limits.put(key,key.equals("inventory_acknowledged")||key.equals("finalizer_allowed"));
            receipt.put("schema","custodial.original-inventory-separation-receipt.v1").put("state","INVENTORY_ACK_RECORDED_LOGICAL_SEPARATION_ONLY")
                .put("approval_id",uuid('d')).put("original_request",command).put("original_request_sha256",hex('0'))
                .put("original_target",new JSONObject(target.toString())).put("issuer",new JSONObject().put("manager_id",uuid('d'))
                    .put("manager_credential_id",uuid('e')).put("manager_device_id","synthetic-manager-device"))
                .put("inventory_manifest_sha256",manifest).put("registration_receipt_sha256",registration)
                .put("approved_at","2026-10-16T12:00:00.000000Z").put("expires_at","2026-10-16T12:05:00.000000Z")
                .put("receipt_sha256",hex('1')).put("limits",limits).put("purpose_admission_id","exact-original-retained-inventory-separation.v1").put("retry_safe",false);
        }
        byte[] targetBytes(){return bytes("\n "+target+"\t");}
        byte[] response(){return bytes("\n {\"ok\":true,\"data\":"+receipt+"}\t");}
    }
    private static NativeOriginalInventorySeparationApprovalWire.UntrustedApproval decode(Fixture f,byte[] target,int status,byte[] response)throws VaultFailure {
        return NativeOriginalInventorySeparationApprovalWire.decode(target,f.parent,f.manifest,f.registration,status,response);
    }
    private static void accepted(Fixture f)throws Exception{try(var data=decode(f,f.targetBytes(),200,f.response())){assertEquals(15,data.json().length());}}
    private static void denied(Fixture f)throws Exception{denied(f,f.targetBytes(),200,f.response());}
    private static void denied(Fixture f,byte[] target,int status,byte[] response)throws Exception{
        try(var data=decode(f,target,status,response)){fail("invalid approval DATA accepted");}
        catch(VaultFailure failure){assertEquals(NativeOriginalInventorySeparationApprovalWire.FAILURE,failure.code);}
    }
    private static byte[] bytes(String text){return text.getBytes(StandardCharsets.UTF_8);}
    private static String uuid(char c){return (""+c).repeat(8)+"-"+(""+c).repeat(4)+"-4"+(""+c).repeat(3)+"-8"+(""+c).repeat(3)+"-"+(""+c).repeat(12);}
    private static String hex(char c){return (""+c).repeat(64);}
    private static byte[] pad(byte[] raw,int length){byte[] bytes=Arrays.copyOf(raw,length);Arrays.fill(bytes,raw.length,length,(byte)' ');return bytes;}
}
