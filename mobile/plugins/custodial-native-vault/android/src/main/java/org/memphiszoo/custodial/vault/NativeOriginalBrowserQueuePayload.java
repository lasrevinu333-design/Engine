package org.memphiszoo.custodial.vault;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** DATA comparison only. Main owns the original binary row/domain/ordinal,
 * source lifetime, argument digest and authenticated native/SQL bindings.
 * A match supplies no source, acceptance, ACK or destructive capability. */
final class NativeOriginalBrowserQueuePayload {
    enum State { MATCHED_ORIGINAL_PAYLOAD_NOT_AUTHORITY, UNRESOLVED_RETAINED }
    private static final int MAX_TAGGED_BYTES=8*1024*1024;
    private static final int MAX_ARGUMENT_BYTES=Math.min(262144,RequestPolicy.MAX_REQUEST_BYTES);
    private static final long MAX_SAFE_INTEGER=9007199254740991L;
    private static final BigDecimal MAX_SAFE_DECIMAL=BigDecimal.valueOf(MAX_SAFE_INTEGER);

    private NativeOriginalBrowserQueuePayload(){}

    static State matchOriginalPayload(byte[] encodedKeyJson,byte[] encodedValueJson,byte[] exactArgumentJson) {
        byte[] key=null,value=null,arguments=null;
        try {
            bounded(encodedKeyJson,MAX_TAGGED_BYTES);bounded(encodedValueJson,MAX_TAGGED_BYTES);
            bounded(exactArgumentJson,MAX_ARGUMENT_BYTES);
            key=encodedKeyJson.clone();value=encodedValueJson.clone();arguments=exactArgumentJson.clone();
            // Keep the existing parser's tighter depth16/value10000 limits.
            // No alternate JSONTokener/parser or shared cap expansion.
            Object keyTree=ProviderWireJson.parse(key,MAX_TAGGED_BYTES);
            Object valueTree=ProviderWireJson.parse(value,MAX_TAGGED_BYTES);
            JSONObject expected=ProviderWireJson.object(arguments,MAX_ARGUMENT_BYTES);
            rejectLossyArgumentNumbers(arguments);
            Budget budget=new Budget();
            Object primary=decode(keyTree,0,budget),decoded=decode(valueTree,0,budget);
            if(!(primary instanceof Double)||!integer((Double)primary)||((Double)primary)<1
                ||!(decoded instanceof Map<?,?>))return State.UNRESOLVED_RETAINED;
            Map<?,?> row=(Map<?,?>)decoded;
            Object type=row.get("type");boolean direct="commit_workflow".equals(type);
            boolean forward="forward-replay-fenced:commit_workflow".equals(type);
            if(!direct&&!forward)return State.UNRESOLVED_RETAINED;
            if(forward&&(!"commit_workflow".equals(row.get("forward_action_type"))
                ||!"scan.v4.snapshot-bound-authority".equals(row.get("forward_replay_contract"))))return State.UNRESOLVED_RETAINED;
            Object id=row.get("id"),version=row.get("schema_version"),payload=row.get("payload");
            if(!(id instanceof Double)||bits((Double)primary)!=bits((Double)id)
                ||!(version instanceof Double)||!integer((Double)version)||((Double)version)<1||((Double)version)>6
                ||!uuid(row.get("operation_id"))||!(payload instanceof Map<?,?>))return State.UNRESOLVED_RETAINED;
            Map<?,?> original=(Map<?,?>)payload;
            Object device=original.get("p_device_id"),completion=original.get("p_client_completion_id");
            if(!(device instanceof String)||!((String)device).matches("[A-Z0-9_-]{1,64}")
                ||!uuid(original.get("p_client_session_id"))||!uuid(completion)
                ||!uuid(original.get("p_native_finish_scan_entry_id"))
                ||(row.get("completion_client_id")!=null&&!row.get("completion_client_id").equals(completion)))
                return State.UNRESOLVED_RETAINED;
            return same(original,expected,0,new Budget())?State.MATCHED_ORIGINAL_PAYLOAD_NOT_AUTHORITY:State.UNRESOLVED_RETAINED;
        } catch(Exception unresolved) {
            return State.UNRESOLVED_RETAINED;
        } finally {
            if(key!=null)Arrays.fill(key,(byte)0);if(value!=null)Arrays.fill(value,(byte)0);
            if(arguments!=null)Arrays.fill(arguments,(byte)0);
            // Parsed strings/boxed DATA are not claimed wipeable.
        }
    }

    // WHOLE_ROW_INDEX_BEGIN: additive DATA ownership, not a caller-selected
    // census, currentness verdict or permission to omit unresolved rows.
    static OriginalQueueRow inspectOriginalRow(byte[] taggedKeyJson,byte[] taggedValueJson) {
        byte[] key=null,value=null;
        try {
            bounded(taggedKeyJson,MAX_TAGGED_BYTES);bounded(taggedValueJson,MAX_TAGGED_BYTES);
            key=taggedKeyJson.clone();value=taggedValueJson.clone();
            Object keyTree=ProviderWireJson.parse(key,MAX_TAGGED_BYTES);
            Object valueTree=ProviderWireJson.parse(value,MAX_TAGGED_BYTES);
            Budget budget=new Budget();
            Object primary=decode(keyTree,0,budget),decoded=decode(valueTree,0,budget);
            if(!(primary instanceof Double)||!integer((Double)primary)||((Double)primary)<1
                ||!(decoded instanceof Map<?,?>))return null;
            Map<?,?> row=(Map<?,?>)decoded;
            Object type=row.get("type");boolean direct="commit_workflow".equals(type);
            boolean forward="forward-replay-fenced:commit_workflow".equals(type);
            if(!direct&&!forward)return null;
            if(forward&&(!"commit_workflow".equals(row.get("forward_action_type"))
                ||!"scan.v4.snapshot-bound-authority".equals(row.get("forward_replay_contract"))))return null;
            Object id=row.get("id"),version=row.get("schema_version"),payload=row.get("payload");
            if(!(id instanceof Double)||bits((Double)primary)!=bits((Double)id)
                ||!(version instanceof Double)||!integer((Double)version)||((Double)version)<1||((Double)version)>6
                ||!uuid(row.get("operation_id"))||!(payload instanceof Map<?,?>))return null;
            Map<?,?> original=(Map<?,?>)payload;
            Object device=original.get("p_device_id"),completion=original.get("p_client_completion_id");
            if(!(device instanceof String)||!((String)device).matches("[A-Z0-9_-]{1,64}")
                ||!uuid(original.get("p_client_session_id"))||!uuid(completion)
                ||!uuid(original.get("p_native_finish_scan_entry_id"))
                ||(row.get("completion_client_id")!=null&&!row.get("completion_client_id").equals(completion)))return null;
            return new OriginalQueueRow(((Double)primary).longValue(),(String)row.get("operation_id"),
                (String)device,(String)original.get("p_client_session_id"),(String)completion,original);
        }catch(Exception unresolved){return null;}
        finally{if(key!=null)Arrays.fill(key,(byte)0);if(value!=null)Arrays.fill(value,(byte)0);}
    }

    /** Detached DATA identities and an owned decoded payload only. No raw
     * getter/serializer/source brand. Main enumerates ALL primary rows and
     * decides ambiguity before selecting any exact native argument loan. */
    static final class OriginalQueueRow implements AutoCloseable {
        final long primaryId;
        final String operationId,deviceId,clientSessionId,clientCompletionId;
        private Map<?,?> payload;
        private OriginalQueueRow(long primaryId,String operationId,String deviceId,String clientSessionId,
            String clientCompletionId,Map<?,?> payload){
            this.primaryId=primaryId;this.operationId=operationId;this.deviceId=deviceId;
            this.clientSessionId=clientSessionId;this.clientCompletionId=clientCompletionId;this.payload=payload;
        }
        synchronized State matchOriginalArgument(byte[] exactArgumentJson) {
            if(payload==null)return State.UNRESOLVED_RETAINED;
            byte[] arguments=null;
            try{
                bounded(exactArgumentJson,MAX_ARGUMENT_BYTES);arguments=exactArgumentJson.clone();
                JSONObject expected=ProviderWireJson.object(arguments,MAX_ARGUMENT_BYTES);
                rejectLossyArgumentNumbers(arguments);
                return same(payload,expected,0,new Budget())?State.MATCHED_ORIGINAL_PAYLOAD_NOT_AUTHORITY:State.UNRESOLVED_RETAINED;
            }catch(Exception unresolved){return State.UNRESOLVED_RETAINED;}
            finally{if(arguments!=null)Arrays.fill(arguments,(byte)0);}
        }
        @Override public synchronized void close(){
            Map<?,?> owned=payload;payload=null;if(owned!=null)clearOwnedGraph(owned);
            // Identity strings and boxed values are not claimed wipeable.
        }
    }
    private static void clearOwnedGraph(Object value){
        if(value instanceof Map<?,?>){Map<?,?> map=(Map<?,?>)value;for(Object child:map.values())clearOwnedGraph(child);map.clear();}
        else if(value instanceof List<?>){List<?> list=(List<?>)value;for(Object child:list)clearOwnedGraph(child);list.clear();}
    }
    // WHOLE_ROW_INDEX_END

    private static void bounded(byte[] bytes,int maximum) {
        if(bytes==null||bytes.length==0||bytes.length>maximum)throw invalid();
    }
    private static final class Budget {
        private int nodes;
        void take(int depth){if(depth>64||++nodes>100000)throw invalid();}
    }
    private static Object decode(Object tree,int depth,Budget budget)throws Exception {
        budget.take(depth);
        if(!(tree instanceof JSONArray))throw invalid();JSONArray tag=(JSONArray)tree;
        if(tag.length()<1||!(tag.get(0) instanceof String))throw invalid();
        switch((String)tag.get(0)){
            case "null":if(tag.length()!=1)throw invalid();return null;
            case "string":if(tag.length()!=2||!(tag.get(1) instanceof String))throw invalid();return tag.get(1);
            case "boolean":if(tag.length()!=2||!(tag.get(1) instanceof Boolean))throw invalid();return tag.get(1);
            case "float64":
                if(tag.length()!=2||!(tag.get(1) instanceof String)||!((String)tag.get(1)).matches("[a-f0-9]{16}"))throw invalid();
                double number=Double.longBitsToDouble(Long.parseUnsignedLong((String)tag.get(1),16));
                requireNumber(number);return number;
            case "array":
                if(tag.length()!=2||!(tag.get(1) instanceof JSONArray))throw invalid();
                JSONArray entries=(JSONArray)tag.get(1);List<Object> list=new ArrayList<>();
                for(int i=0;i<entries.length();i++)list.add(decode(entries.get(i),depth+1,budget));return list;
            case "object":
                if(tag.length()!=2||!(tag.get(1) instanceof JSONArray))throw invalid();
                JSONArray pairs=(JSONArray)tag.get(1);Map<String,Object> object=new LinkedHashMap<>();
                for(int i=0;i<pairs.length();i++){
                    Object entry=pairs.get(i);if(!(entry instanceof JSONArray))throw invalid();JSONArray pair=(JSONArray)entry;
                    if(pair.length()!=2||!(pair.get(0) instanceof String))throw invalid();String name=(String)pair.get(0);
                    if(object.containsKey(name))throw invalid();object.put(name,decode(pair.get(1),depth+1,budget));
                }return object;
            default:throw invalid(); // Date/binary/undefined/hole stay retained.
        }
    }
    private static boolean same(Object original,Object candidate,int depth,Budget budget)throws Exception {
        budget.take(depth);
        if(original==null)return candidate==JSONObject.NULL;
        if(original instanceof Map<?,?>){
            if(!(candidate instanceof JSONObject))return false;Map<?,?> x=(Map<?,?>)original;JSONObject y=(JSONObject)candidate;
            if(x.size()!=y.length())return false;
            for(var entry:x.entrySet()){String name=(String)entry.getKey();if(!y.has(name)||!same(entry.getValue(),y.get(name),depth+1,budget))return false;}
            return true;
        }
        if(original instanceof List<?>){
            if(!(candidate instanceof JSONArray))return false;List<?> x=(List<?>)original;JSONArray y=(JSONArray)candidate;
            if(x.size()!=y.length())return false;for(int i=0;i<x.size();i++)if(!same(x.get(i),y.get(i),depth+1,budget))return false;return true;
        }
        if(original instanceof Double){
            if(!(candidate instanceof Long||candidate instanceof Integer||candidate instanceof Double))return false;
            if(candidate instanceof Long&&(((Long)candidate)<-MAX_SAFE_INTEGER||((Long)candidate)>MAX_SAFE_INTEGER))return false;
            double number=((Number)candidate).doubleValue();requireNumber(number);
            return bits((Double)original)==bits(number);
        }
        return original.getClass()==candidate.getClass()&&original.equals(candidate);
    }
    private static boolean uuid(Object value){return value instanceof String&&((String)value).matches(
        "[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}");}
    private static long bits(double value){return Double.doubleToRawLongBits(value);}
    private static boolean integer(double value){return value==Math.rint(value);}
    private static void requireNumber(double value){
        if(!Double.isFinite(value)||bits(value)==Long.MIN_VALUE||(integer(value)&&Math.abs(value)>MAX_SAFE_INTEGER))throw invalid();
    }
    /** Rejection-only inspection AFTER strict parsing, not another grammar.
     * Long parsing erases integer -0; Double parsing can round unsafe tokens.
     * Never reconstruct or replace the caller's exact argument bytes. */
    private static void rejectLossyArgumentNumbers(byte[] bytes){
        boolean quoted=false,escaped=false;
        for(int i=0;i<bytes.length;i++){
            int ch=bytes[i]&255;
            if(quoted){if(escaped)escaped=false;else if(ch=='\\')escaped=true;else if(ch=='"')quoted=false;continue;}
            if(ch=='"'){quoted=true;continue;}
            if(ch!='-'&&(ch<'0'||ch>'9'))continue;
            int begin=i;
            while(i+1<bytes.length&&numberByte(bytes[i+1]&255))i++;
            String token=new String(bytes,begin,i-begin+1,StandardCharsets.US_ASCII);
            BigDecimal exact=new BigDecimal(token);double number=Double.parseDouble(token);
            if((token.charAt(0)=='-'&&exact.signum()==0)||exact.abs().compareTo(MAX_SAFE_DECIMAL)>0
                ||(number==0&&exact.signum()!=0))throw invalid();
            requireNumber(number);
        }
    }
    private static boolean numberByte(int ch){return ch=='-'||ch=='+'||ch=='.'||ch=='e'||ch=='E'||(ch>='0'&&ch<='9');}
    private static IllegalArgumentException invalid(){return new IllegalArgumentException("original_browser_payload_unresolved");}
}
