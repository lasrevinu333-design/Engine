package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.json.JSONObject;

/** Durable ordinary attempt DATA. This class cannot authorize an OS effect,
 * create a native producer capability, send HTTP or bypass generic receipt deny.
 * The future Engine entry must consume its actual17 read and actual18a owner. */
final class NativeRecurringOrdinaryAttemptJournal {
    private static final String SCHEMA="custodial.native-recurring-ordinary-attempt.v1";
    private static final int MAX=64*1024;
    interface Store {
        void retainOrdinaryRecurringAttempt(NativeRecurringTargetJournal.RetainedTargetData target,
            NativeRecurringOrdinaryPurposeJournal.PreparedData prepared,byte[] latestActualBody,
            Data candidate,NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws VaultFailure;
        void retainOrdinaryRecurringOutcome(Data original,Data candidate,NativeProviderPrincipal principal)throws VaultFailure;
        Data readOrdinaryRecurringAttempt(String key,NativeProviderPrincipal principal)throws VaultFailure;
    }
    static final class Data {
        final String key,record;
        private Data(String key,String record){this.key=key;this.record=record;}
        byte[] originalBody()throws VaultFailure {
            try{return Base64.getDecoder().decode(requireData(key,record).getString("original_body_base64"));}
            catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
        }
        boolean retryAuthorized(){return false;}
        boolean receiptEligible(){return false;}
    }
    private final Store store;
    NativeRecurringOrdinaryAttemptJournal(Store store){this.store=java.util.Objects.requireNonNull(store);}

    /** Pure record construction, not native authority. All original six bytes,
     * including applied_at, are retained before any future transport call. */
    static Data attemptData(NativeRecurringOrdinaryPurposeJournal.PreparedData prepared,
        byte[] originalSixBody,String nativeEffectObservationSha,String latestNativeResponseSha)throws VaultFailure {
        if(prepared==null||originalSixBody==null||originalSixBody.length>16384
            ||nativeEffectObservationSha==null||!nativeEffectObservationSha.matches("[a-f0-9]{64}")
            ||latestNativeResponseSha==null||!latestNativeResponseSha.matches("[a-f0-9]{64}"))throw invalid();
        byte[] body=originalSixBody.clone();
        try{
            JSONObject original=NativeRecurringOrdinaryPurposeJournal.requirePrepared(prepared.key,prepared.record);
            requireBody(original,body);
            JSONObject row=new JSONObject().put("schema",SCHEMA).put("state","ATTEMPTED").put("receipt_eligible",false)
                .put("prepared_record",prepared.record).put("prepared_record_sha256",NativeProviderPrincipal.hash(prepared.record))
                .put("original_body_base64",Base64.getEncoder().encodeToString(body)).put("original_body_sha256",NativeRetainedAttempt.hash(body))
                .put("native_effect_observation_sha256",nativeEffectObservationSha).put("latest_native_response_sha256",latestNativeResponseSha).put("outcome",emptyOutcome("UNKNOWN"));
            String text=row.toString();requireData(prepared.key,text);return new Data(prepared.key,text);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
        finally{java.util.Arrays.fill(body,(byte)0);}
    }
    Data retainAttempt(NativeRecurringTargetJournal.RetainedTargetData target,
        NativeRecurringOrdinaryPurposeJournal.PreparedData prepared,byte[] actualBody,
        byte[] originalSixBody,String nativeEffectObservationSha,
        NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws VaultFailure {
        if(target==null||owner==null||actualBody==null)throw invalid();
        Data candidate=attemptData(prepared,originalSixBody,nativeEffectObservationSha,NativeRetainedAttempt.hash(actualBody));
        store.retainOrdinaryRecurringAttempt(target,prepared,actualBody,candidate,owner);
        return candidate; // DATA only; no dispatch grant or retry token.
    }
    Data readOriginal(String key,NativeProviderPrincipal principal)throws VaultFailure {
        if(principal==null)throw invalid();return store.readOrdinaryRecurringAttempt(key,principal);
    }
    Data recordOutcome(Data original,NativeProviderPrincipal principal,int status,byte[] actualResponse)throws VaultFailure {
        if(original==null||principal==null)throw invalid();
        try{if(!principal.same(NativeProviderPrincipal.fromNativeJournal(originalPrepared(original.key,original.record).getJSONObject("principal"))))throw invalid();}
        catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
        Data next=outcomeData(original,status,actualResponse);
        if(next.record.equals(original.record))return original;
        store.retainOrdinaryRecurringOutcome(original,next,principal);return next;
    }
    /** Only the exact retained six-field original is queried. A missing receipt
     * or unavailable response NEVER authorizes another POST or a new timestamp. */
    static Data outcomeData(Data original,int status,byte[] actualResponse)throws VaultFailure {
        if(original==null)throw invalid();byte[] body=original.originalBody();
        try{
            JSONObject row=requireData(original.key,original.record),prior=row.getJSONObject("outcome");
            NativeRecurringOrdinaryDeliveryWire.Original wire=NativeRecurringOrdinaryDeliveryWire.original(body);
            var observed=NativeRecurringOrdinaryDeliveryWire.outcome(wire,status,actualResponse);
            if(observed.kind==NativeRecurringOrdinaryDeliveryWire.Kind.UNAVAILABLE)return original;
            String old=prior.getString("kind"),kind=observed.kind.name();
            if("CONFLICT".equals(old))return original;
            if("RECEIPT_RECORDED".equals(old)){
                if(!"RECEIPT_RECORDED".equals(kind))throw invalid();
                if(!prior.getString("receipt_id").equals(observed.receiptId)
                    ||!prior.getString("applied_at").equals(observed.appliedAt.toString())
                    ||!prior.getString("received_at").equals(observed.receivedAt.toString()))throw invalid();
                return original;
            }
            JSONObject next=emptyOutcome(kind);
            if(observed.kind==NativeRecurringOrdinaryDeliveryWire.Kind.RECEIPT_RECORDED)
                next.put("receipt_id",observed.receiptId).put("applied_at",observed.appliedAt.toString()).put("received_at",observed.receivedAt.toString());
            row.put("outcome",next);String text=row.toString();requireData(original.key,text);
            return new Data(original.key,text);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
        finally{java.util.Arrays.fill(body,(byte)0);}
    }
    static JSONObject originalPrepared(String key,String record)throws VaultFailure {
        try{return NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,requireData(key,record).getString("prepared_record"));}
        catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    static Data restoredData(String key,String record)throws VaultFailure {requireData(key,record);return new Data(key,record);}
    static void requireSameOriginal(Data original,Data next)throws VaultFailure {
        if(original==null||next==null||!original.key.equals(next.key))throw invalid();
        try{
            JSONObject a=requireData(original.key,original.record),b=requireData(next.key,next.record);
            a.remove("outcome");b.remove("outcome");if(!ProviderWireJson.same(a,b))throw invalid();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    static void requireOutcomeSuccessor(Data original,Data next)throws VaultFailure {
        requireSameOriginal(original,next);
        try{
            JSONObject old=requireData(original.key,original.record).getJSONObject("outcome"),now=requireData(next.key,next.record).getJSONObject("outcome");
            String before=old.getString("kind"),after=now.getString("kind");
            if(("RECEIPT_RECORDED".equals(before)||"CONFLICT".equals(before))&&!ProviderWireJson.same(old,now))throw invalid();
            if("NO_RECORDED_RECEIPT".equals(before)&&"UNKNOWN".equals(after))throw invalid();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    static JSONObject requireData(String key,String text)throws VaultFailure {
        byte[] body=null;
        try{
            if(text==null||text.length()>MAX)throw invalid();JSONObject row=ProviderWireJson.object(text.getBytes(StandardCharsets.UTF_8),MAX);
            NativeRetainedAttempt.keys(row,"schema","state","receipt_eligible","prepared_record","prepared_record_sha256",
                "original_body_base64","original_body_sha256","native_effect_observation_sha256","latest_native_response_sha256","outcome");
            if(!SCHEMA.equals(row.get("schema"))||!"ATTEMPTED".equals(row.get("state"))||!Boolean.FALSE.equals(row.get("receipt_eligible")))throw invalid();
            String raw=exactString(row,"prepared_record"),encoded=exactString(row,"original_body_base64");
            JSONObject prepared=NativeRecurringOrdinaryPurposeJournal.requirePrepared(key,raw);
            if(!NativeProviderPrincipal.hash(raw).equals(exactString(row,"prepared_record_sha256")))throw invalid();
            if(encoded.length()>24*1024)throw invalid();body=Base64.getDecoder().decode(encoded);
            if(!Base64.getEncoder().encodeToString(body).equals(encoded)||body.length>16384
                ||!NativeRetainedAttempt.hash(body).equals(exactString(row,"original_body_sha256"))
                ||!exactString(row,"native_effect_observation_sha256").matches("[a-f0-9]{64}")
                ||!exactString(row,"latest_native_response_sha256").matches("[a-f0-9]{64}"))throw invalid();
            requireBody(prepared,body);JSONObject outcome=row.getJSONObject("outcome");
            NativeRetainedAttempt.keys(outcome,"kind","receipt_id","applied_at","received_at","retry_authorized","current_authority_inferred");
            if(!Boolean.FALSE.equals(outcome.get("retry_authorized"))||!Boolean.FALSE.equals(outcome.get("current_authority_inferred")))throw invalid();
            String kind=exactString(outcome,"kind");
            if(!java.util.Set.of("UNKNOWN","NO_RECORDED_RECEIPT","RECEIPT_RECORDED","CONFLICT").contains(kind))throw invalid();
            if(!"RECEIPT_RECORDED".equals(kind)){
                for(String field:new String[]{"receipt_id","applied_at","received_at"})if(outcome.get(field)!=JSONObject.NULL)throw invalid();
            }else{
                String id=exactString(outcome,"receipt_id");VaultValidation.operationId(id);
                var original=NativeRecurringOrdinaryDeliveryWire.original(body);
                JSONObject post=ProviderWireJson.object(body,16384),data=new JSONObject().put("schema",NativeRecurringOrdinaryDeliveryWire.SCHEMA)
                    .put("intentId",post.get("intent_id")).put("targetType",post.get("target_type")).put("authorityRevision",post.get("authority_revision"))
                    .put("targetDigest",post.get("target_digest")).put("renderedDigest",post.get("rendered_digest"))
                    .put("status","RECEIPT_RECORDED").put("receiptId",id).put("appliedAt",exactString(outcome,"applied_at"))
                    .put("receivedAt",exactString(outcome,"received_at")).put("retryAuthorized",false).put("currentAuthorityNotInferred",true);
                var checked=NativeRecurringOrdinaryDeliveryWire.outcome(original,200,new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8));
                if(checked.kind!=NativeRecurringOrdinaryDeliveryWire.Kind.RECEIPT_RECORDED)throw invalid();
            }
            return row;
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
        finally{if(body!=null)java.util.Arrays.fill(body,(byte)0);}
    }
    private static void requireBody(JSONObject prepared,byte[] body)throws Exception {
        NativeRecurringOrdinaryDeliveryWire.original(body);JSONObject post=ProviderWireJson.object(body,16384),target=prepared.getJSONObject("target");
        if(!prepared.get("intent_id").equals(post.get("intent_id"))||!prepared.get("target_digest").equals(post.get("target_digest"))
            ||!prepared.get("rendered_digest").equals(post.get("rendered_digest"))||!target.get("targetType").equals(post.get("target_type")))throw invalid();
        Object revision=target.get("authorityRevision"),wire=post.get("authority_revision");
        if(!(revision instanceof Integer||revision instanceof Long)||!(wire instanceof Integer||wire instanceof Long)
            ||((Number)revision).longValue()!=((Number)wire).longValue())throw invalid();
    }
    private static JSONObject emptyOutcome(String kind)throws Exception {
        return new JSONObject().put("kind",kind).put("receipt_id",JSONObject.NULL).put("applied_at",JSONObject.NULL).put("received_at",JSONObject.NULL)
            .put("retry_authorized",false).put("current_authority_inferred",false);
    }
    private static String exactString(JSONObject row,String key)throws Exception {Object value=row.get(key);if(!(value instanceof String))throw invalid();return(String)value;}
    static VaultFailure invalid(){return new VaultFailure("custodial_recurring_ordinary_attempt_pending");}
}
