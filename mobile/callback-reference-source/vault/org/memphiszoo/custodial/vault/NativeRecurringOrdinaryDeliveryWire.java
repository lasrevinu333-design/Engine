package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.json.JSONObject;

/** Fixed-path wire DATA only. No transport, credential, owner, dispatch or retry authority. */
final class NativeRecurringOrdinaryDeliveryWire {
    static final String PATH="/schedule-api/my-day-summary/delivery-receipt";
    static final String SCHEMA="static-weekly.original-device-delivery-outcome.v1";
    private static final int MAX=16*1024;
    private static final long SAFE=9007199254740991L;
    private static final Pattern UUID=Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final Pattern SHA=Pattern.compile("[0-9a-f]{64}");
    private static final Pattern TIME=Pattern.compile("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9](\\.[0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})");
    private static final Set<String> POST=Set.of("applied_at","authority_revision","intent_id","rendered_digest","target_digest","target_type");
    private static final Set<String> DATA=Set.of("schema","intentId","targetType","authorityRevision","targetDigest","renderedDigest","status","receiptId","appliedAt","receivedAt","retryAuthorized","currentAuthorityNotInferred");
    private NativeRecurringOrdinaryDeliveryWire() {}

    static final class Original {
        private final String intent,type,target,render,appliedText;
        private final long revision;
        private final Instant applied;
        private Original(String intent,String type,long revision,String target,String render,String text,Instant applied) {
            this.intent=intent;this.type=type;this.revision=revision;this.target=target;this.render=render;this.appliedText=text;this.applied=applied;
        }
        private JSONObject json()throws Exception {
            return new JSONObject().put("intent_id",intent).put("target_type",type).put("authority_revision",revision)
                .put("target_digest",target).put("rendered_digest",render).put("applied_at",appliedText);
        }
    }
    static final class Request {
        final String method,path;
        final Map<String,String> headers;
        private final byte[] bytes;
        private Request(String method,String path,Map<String,String> headers,byte[] bytes) {
            this.method=method;this.path=path;this.headers=headers;this.bytes=bytes.clone();
        }
        byte[] body(){return bytes.clone();}
    }
    enum Kind { RECEIPT_RECORDED, NO_RECORDED_RECEIPT, CONFLICT, UNAVAILABLE }
    static final class Outcome {
        final Kind kind;
        final String receiptId;
        final Instant appliedAt,receivedAt;
        private final Original original;
        private Outcome(Kind kind,Original original,String id,Instant at,Instant received) {
            this.kind=kind;this.original=original;receiptId=id;appliedAt=at;receivedAt=received;
        }
        boolean retryAuthorized(){return false;}
        boolean currentAuthorityInferred(){return false;}
    }

    static Original original(byte[] postBody)throws VaultFailure {
        try {
            JSONObject x=ProviderWireJson.object(postBody,MAX);keys(x,POST);
            String intent=uuid(x,"intent_id"),type=type(x,"target_type"),target=digest(x,"target_digest"),render=digest(x,"rendered_digest");
            long revision=integer(x,"authority_revision");String text=string(x,"applied_at");Instant at=time(text);
            // The actual HTTP POST converts through JS Date (millisecond precision).
            // Refuse a submillisecond original rather than silently retimestamp it.
            if(at.getNano()%1_000_000!=0||("BLOCKED_RECURRING_AUTHORITY".equals(type)&&!target.equals(render)))throw invalid();
            return new Original(intent,type,revision,target,render,text,at);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    static Request post(Original original)throws VaultFailure {
        if(original==null)throw invalid();
        try{return new Request("POST",PATH,Map.of("Accept","application/json","Content-Type","application/json"),original.json().toString().getBytes(StandardCharsets.UTF_8));}
        catch(Exception error){throw invalid();}
    }
    static Request getOutcome(Original original)throws VaultFailure {
        if(original==null)throw invalid();
        return new Request("GET",PATH+"?intent_id="+original.intent+"&target_type="+original.type,Map.of("Accept","application/json"),new byte[0]);
    }
    static Outcome outcome(Original original,int httpStatus,byte[] body) {
        return outcome(original,null,httpStatus,body);
    }
    /** A prior recorded DATA result may pin its immutable receipt identity too.
     * This does not authorize an effect, another POST, or a current winner. */
    static Outcome outcome(Original original,Outcome previous,int httpStatus,byte[] body) {
        if(original==null)return result(Kind.UNAVAILABLE,null);
        if(previous!=null&&(!sameOriginal(original,previous.original)||previous.kind==Kind.CONFLICT))return result(Kind.CONFLICT,original);
        if(httpStatus!=200)return result(Kind.UNAVAILABLE,original);
        try {
            JSONObject envelope=ProviderWireJson.object(body,MAX);
            Set<String> e=names(envelope);
            if(!e.equals(Set.of("ok","data"))&&!e.equals(Set.of("ok","data","meta")))throw invalid();
            if(!Boolean.TRUE.equals(envelope.get("ok"))||!(envelope.get("data") instanceof JSONObject))throw invalid();
            if(envelope.has("meta")) {
                if(!(envelope.get("meta") instanceof JSONObject))throw invalid();
                JSONObject meta=(JSONObject)envelope.get("meta");keys(meta,Set.of("version","release_id","contract_version"));
                for(String key:names(meta)){String value=string(meta,key);if(value.isEmpty()||value.length()>256)throw invalid();}
            }
            JSONObject d=(JSONObject)envelope.get("data");keys(d,DATA);
            if(!SCHEMA.equals(string(d,"schema"))||!Boolean.FALSE.equals(d.get("retryAuthorized"))
                ||!Boolean.TRUE.equals(d.get("currentAuthorityNotInferred")))throw invalid();
            String intent=uuid(d,"intentId"),type=type(d,"targetType"),target=digest(d,"targetDigest"),render=digest(d,"renderedDigest");
            long revision=integer(d,"authorityRevision");String status=string(d,"status");
            if(!status.equals("RECEIPT_RECORDED")&&!status.equals("NO_RECORDED_RECEIPT"))throw invalid();
            boolean matches=original.intent.equals(intent)&&original.type.equals(type)&&original.revision==revision
                &&original.target.equals(target)&&original.render.equals(render);
            if(status.equals("NO_RECORDED_RECEIPT")) {
                if(d.get("receiptId")!=JSONObject.NULL||d.get("appliedAt")!=JSONObject.NULL||d.get("receivedAt")!=JSONObject.NULL)throw invalid();
                if(!matches||(previous!=null&&previous.kind==Kind.RECEIPT_RECORDED))return result(Kind.CONFLICT,original);
                return result(Kind.NO_RECORDED_RECEIPT,original);
            }
            String receipt=uuid(d,"receiptId");Instant at=time(string(d,"appliedAt")),received=time(string(d,"receivedAt"));
            if(!matches||!original.applied.equals(at))return result(Kind.CONFLICT,original);
            if(previous!=null&&previous.kind==Kind.RECEIPT_RECORDED
                &&(!receipt.equals(previous.receiptId)||!at.equals(previous.appliedAt)||!received.equals(previous.receivedAt)))return result(Kind.CONFLICT,original);
            return new Outcome(Kind.RECEIPT_RECORDED,original,receipt,at,received);
        }catch(Exception error){return result(Kind.UNAVAILABLE,original);}
    }
    private static boolean sameOriginal(Original a,Original b) {
        return b!=null&&a.intent.equals(b.intent)&&a.type.equals(b.type)&&a.revision==b.revision
            &&a.target.equals(b.target)&&a.render.equals(b.render)&&a.applied.equals(b.applied);
    }
    private static Outcome result(Kind kind,Original original){return new Outcome(kind,original,null,null,null);}
    private static Set<String> names(JSONObject x){Set<String> result=new HashSet<>();x.keys().forEachRemaining(result::add);return result;}
    private static void keys(JSONObject x,Set<String> expected)throws VaultFailure{if(!names(x).equals(expected))throw invalid();}
    private static String string(JSONObject x,String key)throws Exception{Object value=x.get(key);if(!(value instanceof String))throw invalid();return (String)value;}
    private static String uuid(JSONObject x,String key)throws Exception{String value=string(x,key);if(!UUID.matcher(value).matches())throw invalid();return value;}
    private static String digest(JSONObject x,String key)throws Exception{String value=string(x,key);if(!SHA.matcher(value).matches())throw invalid();return value;}
    private static String type(JSONObject x,String key)throws Exception{String value=string(x,key);if(!value.equals("SCHEDULE")&&!value.equals("BLOCKED_RECURRING_AUTHORITY"))throw invalid();return value;}
    private static long integer(JSONObject x,String key)throws Exception{Object value=x.get(key);if(!(value instanceof Long)&&!(value instanceof Integer))throw invalid();long n=((Number)value).longValue();if(n<1||n>SAFE)throw invalid();return n;}
    private static Instant time(String value)throws Exception {
        if(value==null||value.length()>35||!TIME.matcher(value).matches())throw invalid();
        Instant at=OffsetDateTime.parse(value,DateTimeFormatter.ISO_OFFSET_DATE_TIME.withResolverStyle(ResolverStyle.STRICT)).toInstant();
        if(at.isBefore(Instant.parse("0001-01-01T00:00:00Z"))||at.isAfter(Instant.parse("9999-12-31T23:59:59.999999999Z")))throw invalid();
        return at;
    }
    private static VaultFailure invalid(){return new VaultFailure("custodial_original_delivery_wire_invalid");}
}
