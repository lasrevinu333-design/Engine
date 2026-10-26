package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** Pure fixed-wire DATA fixtures, not an authenticated send, native owner or backend effect. */
public final class NativeRecurringOrdinaryDeliveryWireTest {
    private static final String ID="11111111-1111-4111-8111-111111111111",RID="22222222-2222-4222-8222-222222222222";
    private static final String AT="2026-10-21T23:01:02.123Z",RECEIVED="2026-10-21T23:01:03.123456+00:00";
    private static final String TARGET="a".repeat(64),VIEW="b".repeat(64);
    private static byte[] bytes(String value){return value.getBytes(StandardCharsets.UTF_8);}
    private static JSONObject post()throws Exception{return new JSONObject().put("intent_id",ID).put("target_type","SCHEDULE")
        .put("authority_revision",7).put("target_digest",TARGET).put("rendered_digest",VIEW).put("applied_at",AT);}
    private static NativeRecurringOrdinaryDeliveryWire.Original original()throws Exception{return NativeRecurringOrdinaryDeliveryWire.original(bytes(post().toString()));}
    private static JSONObject envelope(boolean recorded)throws Exception {
        JSONObject d=new JSONObject().put("schema",NativeRecurringOrdinaryDeliveryWire.SCHEMA).put("intentId",ID).put("targetType","SCHEDULE")
            .put("authorityRevision",7).put("targetDigest",TARGET).put("renderedDigest",VIEW)
            .put("status",recorded?"RECEIPT_RECORDED":"NO_RECORDED_RECEIPT")
            .put("receiptId",recorded?RID:JSONObject.NULL).put("appliedAt",recorded?AT:JSONObject.NULL)
            .put("receivedAt",recorded?RECEIVED:JSONObject.NULL).put("retryAuthorized",false).put("currentAuthorityNotInferred",true);
        return new JSONObject().put("ok",true).put("data",d).put("meta",new JSONObject()
            .put("version","synthetic").put("release_id","synthetic").put("contract_version","synthetic"));
    }
    private static NativeRecurringOrdinaryDeliveryWire.Outcome read(JSONObject value)throws Exception {
        return NativeRecurringOrdinaryDeliveryWire.outcome(original(),200,bytes(value.toString()));
    }
    private static void unavailable(String raw)throws Exception {
        var result=NativeRecurringOrdinaryDeliveryWire.outcome(original(),200,bytes(raw));
        assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.UNAVAILABLE,result.kind);assertFalse(result.retryAuthorized());
    }
    @Test public void fixedPostHasOnlySixFieldsAndNoCredentialOrCallerPath()throws Exception {
        var request=NativeRecurringOrdinaryDeliveryWire.post(original());assertEquals("POST",request.method);
        assertEquals("/schedule-api/my-day-summary/delivery-receipt",request.path);
        assertEquals(Set.of("Accept","Content-Type"),request.headers.keySet());
        assertEquals("application/json",request.headers.get("Content-Type"));
        assertTrue(ProviderWireJson.same(post(),ProviderWireJson.object(request.body(),16384)));
        byte[] copy=request.body();copy[0]=0;assertEquals('{',request.body()[0]);
        assertThrows(UnsupportedOperationException.class,()->request.headers.put("Authorization","forged"));
    }
    @Test public void fixedGetUsesOnlyValidatedOriginalIdentityAndNoBody()throws Exception {
        var request=NativeRecurringOrdinaryDeliveryWire.getOutcome(original());assertEquals("GET",request.method);
        assertEquals(NativeRecurringOrdinaryDeliveryWire.PATH+"?intent_id="+ID+"&target_type=SCHEDULE",request.path);
        assertEquals(Set.of("Accept"),request.headers.keySet());assertEquals(0,request.body().length);
    }
    @Test public void recordedOutcomeBindsEveryOriginalFieldAndRetainsMicrosecondReceiveTime()throws Exception {
        var result=read(envelope(true));assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.RECEIPT_RECORDED,result.kind);
        assertEquals(RID,result.receiptId);assertEquals(Instant.parse(AT),result.appliedAt);
        assertEquals(Instant.parse("2026-10-21T23:01:03.123456Z"),result.receivedAt);
        assertFalse(result.retryAuthorized());assertFalse(result.currentAuthorityInferred());
    }
    @Test public void absentReceiptIsOnlyHistoricalAbsenceAndNeverRetryPermission()throws Exception {
        var result=read(envelope(false));assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.NO_RECORDED_RECEIPT,result.kind);
        assertNull(result.receiptId);assertNull(result.appliedAt);assertNull(result.receivedAt);assertFalse(result.retryAuthorized());
    }
    @Test public void completeBlockedWireUsesTargetAsRenderedDigest()throws Exception {
        JSONObject p=post().put("target_type","BLOCKED_RECURRING_AUTHORITY").put("rendered_digest",TARGET);
        var original=NativeRecurringOrdinaryDeliveryWire.original(bytes(p.toString()));var e=envelope(true);
        e.getJSONObject("data").put("targetType","BLOCKED_RECURRING_AUTHORITY").put("renderedDigest",TARGET);
        assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.RECEIPT_RECORDED,NativeRecurringOrdinaryDeliveryWire.outcome(original,200,bytes(e.toString())).kind);
        p.put("rendered_digest",VIEW);assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(bytes(p.toString())));
    }
    @Test public void validDifferentOldTargetOrRevisionIsConflictNotCurrentWinnerAdoption()throws Exception {
        for(String key:new String[]{"intentId","targetType","authorityRevision","targetDigest","renderedDigest","appliedAt"}) {
            JSONObject e=envelope(true);Object replacement=key.equals("intentId")?RID:key.equals("targetType")?"BLOCKED_RECURRING_AUTHORITY"
                :key.equals("authorityRevision")?8:key.equals("appliedAt")?"2026-10-21T23:01:02.124Z":"c".repeat(64);
            e.getJSONObject("data").put(key,replacement);var result=read(e);
            assertEquals(key,NativeRecurringOrdinaryDeliveryWire.Kind.CONFLICT,result.kind);assertFalse(result.retryAuthorized());
        }
    }
    @Test public void appliedInstantAllowsEquivalentOffsetButNotRetimestamping()throws Exception {
        JSONObject e=envelope(true);e.getJSONObject("data").put("appliedAt","2026-10-21T18:01:02.123-05:00");
        assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.RECEIPT_RECORDED,read(e).kind);
        e.getJSONObject("data").put("appliedAt","2026-10-21T23:01:02.123001Z");
        assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.CONFLICT,read(e).kind);
    }
    @Test public void previouslyObservedReceiptCannotChangeIdentityOrEitherTimestampOrDisappear()throws Exception {
        var original=original();var previous=NativeRecurringOrdinaryDeliveryWire.outcome(original,200,bytes(envelope(true).toString()));
        assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.RECEIPT_RECORDED,previous.kind);
        for(String key:new String[]{"receiptId","receivedAt","appliedAt"}) {
            JSONObject e=envelope(true);e.getJSONObject("data").put(key,key.equals("receiptId")?ID:"2026-10-21T23:01:04Z");
            var changed=NativeRecurringOrdinaryDeliveryWire.outcome(original,previous,200,bytes(e.toString()));
            assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.CONFLICT,changed.kind);assertFalse(changed.retryAuthorized());
        }
        assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.CONFLICT,NativeRecurringOrdinaryDeliveryWire.outcome(original,previous,200,bytes(envelope(false).toString())).kind);
        JSONObject other=post().put("intent_id",RID);var foreign=NativeRecurringOrdinaryDeliveryWire.original(bytes(other.toString()));
        assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.CONFLICT,NativeRecurringOrdinaryDeliveryWire.outcome(foreign,previous,200,bytes(envelope(true).toString())).kind);
    }
    @Test public void noRecordedStatusRequiresAllThreeReceiptFieldsExplicitlyNull()throws Exception {
        for(String key:new String[]{"receiptId","appliedAt","receivedAt"}) {
            JSONObject e=envelope(false);e.getJSONObject("data").put(key,key.equals("receiptId")?RID:AT);unavailable(e.toString());
            e=envelope(false);e.getJSONObject("data").remove(key);unavailable(e.toString());
        }
    }
    @Test public void recordedStatusRejectsNullOrMalformedReceiptFields()throws Exception {
        for(String key:new String[]{"receiptId","appliedAt","receivedAt"}) {
            JSONObject e=envelope(true);e.getJSONObject("data").put(key,JSONObject.NULL);unavailable(e.toString());
            e=envelope(true);e.getJSONObject("data").put(key,key.equals("receiptId")?"not-a-uuid":"not-a-time");unavailable(e.toString());
        }
    }
    @Test public void originalRejectsExtraMissingDuplicateAndMalformedWire()throws Exception {
        JSONObject extra=post().put("device_id","KIOSK_08");assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(bytes(extra.toString())));
        JSONObject missing=post();missing.remove("target_digest");assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(bytes(missing.toString())));
        String raw=post().toString();for(String bad:new String[]{raw.replaceFirst("\\{","{\"intent_id\":\""+ID+"\","),raw+"{}","[]","{'x':1}","\ufeff"+raw})
            assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(bytes(bad)));
    }
    @Test public void originalRejectsUnsafeDecimalExponentAndStringIntegerWithoutCoercion()throws Exception {
        for(Object n:new Object[]{0,-1,9007199254740992L,"7",true,JSONObject.NULL}) {
            JSONObject p=post().put("authority_revision",n);assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(bytes(p.toString())));
        }
        String raw=post().toString();for(String n:new String[]{"7.0","7e0","9007199254740993"}) {
            String bad=raw.replace("\"authority_revision\":7","\"authority_revision\":"+n);
            assertNotEquals(raw,bad);assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(bytes(bad)));
        }
        assertNotNull(NativeRecurringOrdinaryDeliveryWire.original(bytes(post().put("authority_revision",9007199254740991L).toString())));
    }
    @Test public void outcomeRejectsUnsafeNumericsAndBooleanStringCoercion()throws Exception {
        for(Object n:new Object[]{0,-1,9007199254740992L,"7",true,JSONObject.NULL}) {
            JSONObject e=envelope(true);e.getJSONObject("data").put("authorityRevision",n);unavailable(e.toString());
        }
        for(String key:new String[]{"retryAuthorized","currentAuthorityNotInferred"}) {
            JSONObject e=envelope(true);e.getJSONObject("data").put(key,key.equals("retryAuthorized")?"false":"true");unavailable(e.toString());
        }
        String raw=envelope(true).toString();for(String n:new String[]{"7.0","7e0"})unavailable(raw.replace("\"authorityRevision\":7","\"authorityRevision\":"+n));
    }
    @Test public void timestampsRejectInvalidCalendarLeapSecondsInfiniteOffsetAndSubmillisecondPost()throws Exception {
        for(String at:new String[]{"2026-02-29T00:00:00Z","2026-10-21T23:01:60Z","infinity","2026-10-21","2026-10-21T23:01:02",
            "2026-10-21T23:01:02+25:00","0000-01-01T00:00:00Z","2026-10-21T23:01:02.123001Z"}) {
            JSONObject p=post().put("applied_at",at);assertThrows(at,VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(bytes(p.toString())));
        }
        JSONObject e=envelope(true);e.getJSONObject("data").put("receivedAt","2026-02-29T00:00:00Z");unavailable(e.toString());
    }
    @Test public void pathsTypesUuidDigestsAndAppliedValuesNeverUseStringCoercion()throws Exception {
        for(String key:new String[]{"intent_id","target_type","target_digest","rendered_digest","applied_at"}) {
            JSONObject p=post().put(key,7);assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(bytes(p.toString())));
        }
        for(String key:new String[]{"intent_id","target_type","target_digest","rendered_digest"}) {
            JSONObject p=post().put(key,key.equals("intent_id")?ID+"?x=1":key.equals("target_type")?"SCHEDULE&retry=true":"A".repeat(64));
            assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(bytes(p.toString())));
        }
    }
    @Test public void envelopeExtraDuplicateWrongSchemaFailedHttpAndPostAckRemainUnavailable()throws Exception {
        JSONObject e=envelope(true).put("unexpected",true);unavailable(e.toString());
        e=envelope(true);e.getJSONObject("data").put("unexpected",true);unavailable(e.toString());
        e=envelope(true);e.getJSONObject("data").put("schema","future");unavailable(e.toString());
        e=envelope(true).put("ok","true");unavailable(e.toString());
        String raw=envelope(true).toString();unavailable(raw.replaceFirst("\\{","{\"ok\":true,"));
        for(int code:new int[]{0,201,204,302,400,403,500})assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.UNAVAILABLE,NativeRecurringOrdinaryDeliveryWire.outcome(original(),code,bytes(raw)).kind);
        unavailable("{\"ok\":true,\"data\":{\"schema\":\"static-weekly.device-schedule-delivery-receipt.v1\",\"receipt\":{}}}");
    }
    @Test public void boundedUtf8AndNoResponseCannotClaimReceipt()throws Exception {
        for(byte[] raw:new byte[][]{null,new byte[0],new byte[16385],new byte[]{(byte)0xc3,(byte)0x28}}) {
            assertEquals(NativeRecurringOrdinaryDeliveryWire.Kind.UNAVAILABLE,NativeRecurringOrdinaryDeliveryWire.outcome(original(),200,raw).kind);
            assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.original(raw));
        }
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.post(null));
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryDeliveryWire.getOutcome(null));
    }
}
