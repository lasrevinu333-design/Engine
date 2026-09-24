package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Receiver-owned legacy authority. Never an enrollment operation or frozen-work edge.
 * Separate records preserve the strict v2 vault snapshot and all original work bytes.
 */
final class NativeLegacyLineageJournal {
    static final String FAILURE="custodial_legacy_lineage_invalid";
    static final String BINDING="custodial-legacy-lineage-binding.v1";
    static final String JOURNAL="native-assigned-activation-legacy.v1";
    static final String PRINCIPAL="custodial-protected-principal.v2";
    static final String OBSERVED="authenticated_legacy_installation_observation";
    static final String CONFIRMED="confirmed_enrollment_operation";
    static final String[] BINDING_KEYS={"schema_version","binding_id","binding_kind","activation_operation_id","device_id",
        "credential_id","installation_binding_sha256","source_enrollment_operation_id","current_recovery_operation_id",
        "employee_id","assignment_epoch","server_observed_at"};
    static final String[] JOURNAL_KEYS={"schema_version","operation_id","device_id","credential_id","transition",
        "installation_seal","enrolled_at","installation_binding_sha256","legacy_binding_id","legacy_binding_kind"};
    static final String[] RECEIPT_KEYS={"operation_id","device_id","credential_id","outcome","changed","transition",
        "journal_schema","journal_binding_sha256","legacy_binding_id","legacy_binding_kind","installation_binding_sha256"};
    static final String[] PRINCIPAL_KEYS={"schema_version","device_id","employee_id","assignment_epoch","credential_id",
        "activation_operation_id","activation_receipt_sha256","legacy_binding_id","legacy_binding_kind",
        "installation_binding_sha256","installation_seal","enrolled_at"};
    interface Store {
        String loadLegacyRecord(String key) throws VaultFailure;
        void saveLegacyRecord(String key,String value) throws VaultFailure;
    }
    private static final Object LOCK=new Object();
    private final Store store;
    NativeLegacyLineageJournal(Store store){this.store=store;}
    static boolean applies(Map<String,Object> state){
        Object raw=state.get("installation");
        if(!(raw instanceof Map))return false;
        Map<?,?> i=(Map<?,?>)raw;
        return Boolean.TRUE.equals(i.get("migrated_from_credential_only_state"))
            &&(i.get("enrollment_operation_id")==null||"".equals(i.get("enrollment_operation_id")));
    }
    static final class Context {
        final String operation,device,credential,digest,seal,enrolledAt;
        final boolean recovered;
        Context(String operation,VaultSnapshot state,char[] token)throws VaultFailure{
            this.operation=VaultValidation.operationId(operation);
            if(state.phase!=VaultPhase.ACTIVE||state.installation==null||!state.installation.migratedFromCredentialOnlyState
                ||!state.installation.enrollmentOperationId.isEmpty())throw invalid();
            device=state.deviceId;credential=NativeAttestation.resolveStoredCredentialId(token,state.metadata.credentialId);
            if(!device.equals(state.installation.deviceId))throw invalid();
            seal=state.installation.installationSeal;enrolledAt=state.installation.enrolledAt;
            recovered=this.operation.equals(state.operationId);
            if(recovered&&!"recovery".equals(state.flow))throw invalid();
            digest=installationDigest(state.installation.safeRecord());
        }
        JSONObject request()throws VaultFailure{
            try{return new JSONObject().put("schema_version","custodial-legacy-lineage-binding-request.v1")
                .put("operation_id",operation).put("device_id",device).put("credential_id",credential)
                .put("installation_binding_sha256",digest).put("migrated_from_credential_only_state",true);}
            catch(Exception e){throw invalid(e);}
        }
    }
    static String installationDigest(Map<String,Object> record)throws VaultFailure{
        try{
            JSONObject i=new JSONObject(record);
            if(!Integer.valueOf(1).equals(i.opt("schema_version"))||!(i.opt("migrated_from_credential_only_state") instanceof Boolean)
                ||!(i.opt("enrolled_at") instanceof String)||!(i.opt("installation_seal") instanceof String))throw invalid();
            VaultValidation.deviceId(i.getString("device_id"));
            Object op=i.opt("enrollment_operation_id");
            if(op!=null&&op!=JSONObject.NULL)VaultValidation.operationId((String)op);
            return hash(new JSONArray().put("custodial-installation-binding-digest.v1").put(1).put(i.getString("device_id"))
                .put(i.getString("installation_seal")).put(i.getString("enrolled_at")).put(i.getBoolean("migrated_from_credential_only_state"))
                .put(op==null?JSONObject.NULL:op).toString());
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}
    }
    static final class Binding {
        private final JSONObject value;
        Binding(JSONObject supplied,Context c)throws VaultFailure{
            try{
                exact(supplied,BINDING_KEYS);value=copy(supplied);
                if(!BINDING.equals(value.getString("schema_version"))||!c.operation.equals(value.getString("activation_operation_id"))
                    ||!c.device.equals(value.getString("device_id"))||!c.credential.equals(value.getString("credential_id"))
                    ||!c.digest.equals(value.getString("installation_binding_sha256")))throw invalid();
                uuid(value.getString("binding_id"));uuid(value.getString("employee_id"));epoch(value.get("assignment_epoch"));
                String time=value.getString("server_observed_at");
                if(!time.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{6}Z"))throw invalid();
                Instant.parse(time);
                String kind=value.getString("binding_kind");
                Object original=value.get("source_enrollment_operation_id"),recovery=value.get("current_recovery_operation_id");
                if(CONFIRMED.equals(kind)){
                    uuid((String)original);if(recovery!=JSONObject.NULL||c.recovered)throw invalid();
                }else if(OBSERVED.equals(kind)){
                    if(original!=JSONObject.NULL||!(c.recovered?c.operation.equals(recovery):recovery==JSONObject.NULL))throw invalid();
                }else throw invalid();
            }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}
        }
        JSONObject json()throws VaultFailure{return copy(value);}
        String id(){return value.optString("binding_id");}
        String kind(){return value.optString("binding_kind");}
    }
    static final class Terminal {
        final Binding binding;
        final String state,receiptSha;
        private final JSONObject receipt;
        Terminal(JSONObject data,Context c,Binding expected,JSONObject sent)throws VaultFailure{
            try{
                exact(data,"status","binding","activation_receipt_sha256");
                binding=new Binding(data.getJSONObject("binding"),c);
                if(!same(binding.json(),expected.json()))throw invalid();
                JSONObject status=data.getJSONObject("status");
                state=c.recovered?"native_active":"not_required";
                if(!state.equals(status.getString("state"))||!c.operation.equals(status.getString("operation_id"))
                    ||!c.device.equals(status.getString("device_id"))
                    ||!binding.value.getString("employee_id").equals(status.getString("employee_id"))
                    ||epoch(binding.value.get("assignment_epoch"))!=epoch(status.get("assignment_epoch")))throw invalid();
                receipt=status.getJSONObject("native_receipt");exact(receipt,RECEIPT_KEYS);exact(sent,RECEIPT_KEYS);
                if(!same(sent,receipt))throw invalid();
                receiptSha=hex(data.getString("activation_receipt_sha256"));
            }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}
        }
    }
    Binding captureBinding(Context c,Binding received)throws VaultFailure{
        synchronized(LOCK){
            Binding validated=new Binding(received.json(),c);
            retainExact("binding:"+c.operation,validated.json());
            return new Binding(read("binding:"+c.operation),c);
        }
    }
    JSONObject captureActivation(Context c,Binding b)throws VaultFailure{
        synchronized(LOCK){JSONObject value=activation(c,b);retainExact("activation:"+c.operation,value);return receipt(c,b,value);}
    }
    void captureTerminal(Context c,Terminal terminal)throws VaultFailure{
        synchronized(LOCK){
            try{
                if(store.loadLegacyRecord("invalidated:"+c.operation)!=null)throw invalid();
                Binding b=new Binding(read("binding:"+c.operation),c);
                JSONObject activation=read("activation:"+c.operation);
                if(!same(activation,activation(c,b))||!same(receipt(c,b,activation),terminal.receipt)
                    ||!same(terminal.binding.json(),b.json()))throw invalid();
                JSONObject principal=new JSONObject().put("schema_version",PRINCIPAL).put("device_id",c.device)
                    .put("employee_id",b.value.getString("employee_id")).put("assignment_epoch",epoch(b.value.get("assignment_epoch")))
                    .put("credential_id",c.credential).put("activation_operation_id",c.operation)
                    .put("activation_receipt_sha256",terminal.receiptSha).put("legacy_binding_id",b.id()).put("legacy_binding_kind",b.kind())
                    .put("installation_binding_sha256",c.digest).put("installation_seal",c.seal).put("enrolled_at",c.enrolledAt);
                JSONObject proof=new JSONObject().put("schema_version","native-assigned-activation-legacy-transport.v1")
                    .put("operation_id",c.operation).put("result",terminal.state).put("principal",principal)
                    .put("native_receipt",terminal.receipt);
                retainExact("terminal:"+c.operation,proof);
                // Do not let an old same-epoch terminal replay replace a later
                // principal. The receiver must bind current activation first.
                String old=store.loadLegacyRecord("principal");
                if(old!=null){
                    JSONObject previous=new JSONObject(old);exact(previous,PRINCIPAL_KEYS);
                    if(c.device.equals(previous.getString("device_id"))&&c.seal.equals(previous.getString("installation_seal"))){
                        String previousOperation=uuid(previous.getString("activation_operation_id"));
                        String invalidation=store.loadLegacyRecord("invalidated:"+previousOperation);
                        JSONObject floor=invalidation==null?previous:new JSONObject(invalidation);
                        long before=epoch(floor.get("assignment_epoch")),after=epoch(principal.get("assignment_epoch"));
                        if(after<before||(after==before&&!floor.getString("employee_id").equals(principal.getString("employee_id"))))throw invalid();
                        JSONObject previousBinding=read("binding:"+previousOperation);
                        if(!previousOperation.equals(c.operation)&&!Instant.parse(b.value.getString("server_observed_at"))
                            .isAfter(Instant.parse(previousBinding.getString("server_observed_at"))))throw invalid();
                    }
                }
                save("principal",principal);
            }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}
        }
    }
    String principalOperation()throws VaultFailure{
        synchronized(LOCK){String value=store.loadLegacyRecord("principal");if(value==null)return null;
            try{JSONObject p=new JSONObject(value);exact(p,PRINCIPAL_KEYS);return uuid(p.getString("activation_operation_id"));}
            catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}}
    }
    JSONObject readPrincipal(Context c)throws VaultFailure{
        synchronized(LOCK){
            if(store.loadLegacyRecord("invalidated:"+c.operation)!=null)return null;
            String encoded=store.loadLegacyRecord("principal");if(encoded==null)return null;
            try{
                JSONObject p=new JSONObject(encoded);exact(p,PRINCIPAL_KEYS);
                if(!c.operation.equals(p.getString("activation_operation_id"))||!c.device.equals(p.getString("device_id"))
                    ||!c.credential.equals(p.getString("credential_id"))||!c.digest.equals(p.getString("installation_binding_sha256"))
                    ||!c.seal.equals(p.getString("installation_seal"))||!c.enrolledAt.equals(p.getString("enrolled_at")))return null;
                Binding b=new Binding(read("binding:"+c.operation),c);
                JSONObject a=read("activation:"+c.operation),t=read("terminal:"+c.operation);
                exact(t,"schema_version","operation_id","result","principal","native_receipt");
                if(!"native-assigned-activation-legacy-transport.v1".equals(t.getString("schema_version"))
                    ||!PRINCIPAL.equals(p.getString("schema_version"))||!c.operation.equals(t.getString("operation_id"))
                    ||!(c.recovered?"native_active":"not_required").equals(t.getString("result"))
                    ||!same(a,activation(c,b))||!same(receipt(c,b,a),t.getJSONObject("native_receipt"))
                    ||!same(p,t.getJSONObject("principal"))||!b.id().equals(p.getString("legacy_binding_id"))
                    ||!b.kind().equals(p.getString("legacy_binding_kind"))||!b.value.getString("employee_id").equals(p.getString("employee_id"))
                    ||epoch(b.value.get("assignment_epoch"))!=epoch(p.get("assignment_epoch")))throw invalid();
                hex(p.getString("activation_receipt_sha256"));return p;
            }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}
        }
    }
    String resultFor(Context c)throws VaultFailure{return readPrincipal(c)==null?"delivery_unknown":c.recovered?"native_active":"not_required";}
    JSONObject readActivation(Context c)throws VaultFailure{
        synchronized(LOCK){return readPrincipal(c)==null?null:read("activation:"+c.operation);}
    }
    // Authenticated status may invalidate an old receiver observation, but may
    // never mint a replacement principal or manufacture enrollment lineage.
    void observeStatus(Context c,AuthorizedRequest request,AuthorizedResponse response)throws VaultFailure{
        if(!NativePrincipalJournal.isStatus(request)||response.status!=200)return;
        synchronized(LOCK){
            JSONObject current=readPrincipal(c);if(current==null)return;
            try{
                JSONObject envelope=new JSONObject(new String(response.body,StandardCharsets.UTF_8));
                JSONObject data=envelope.getJSONObject("data");
                if(!Boolean.TRUE.equals(envelope.opt("ok"))||!Boolean.TRUE.equals(data.opt("authenticated"))
                    ||!c.device.equals(data.getString("canonical_device_id"))||!c.credential.equals(data.getString("credential_id")))throw invalid();
                String employee=uuid(data.getString("employee_id"));long next=epoch(data.get("assignment_epoch")),before=epoch(current.get("assignment_epoch"));
                if(next<before)throw invalid();
                if(next==before&&employee.equals(current.getString("employee_id")))return;
                retainExact("invalidated:"+c.operation,new JSONObject().put("schema_version","native-legacy-principal-invalidated.v1")
                    .put("operation_id",c.operation).put("employee_id",employee).put("assignment_epoch",next));
            }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}
        }
    }
    private JSONObject activation(Context c,Binding b)throws VaultFailure{
        try{new Binding(b.json(),c);return new JSONObject().put("schema_version",JOURNAL).put("operation_id",c.operation)
            .put("device_id",c.device).put("credential_id",c.credential).put("transition",c.recovered?"confirmed_recovery":"healthy_no_change")
            .put("installation_seal",c.seal).put("enrolled_at",c.enrolledAt).put("installation_binding_sha256",c.digest)
            .put("legacy_binding_id",b.id()).put("legacy_binding_kind",b.kind());}
        catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}
    }
    private static JSONObject receipt(Context c,Binding b,JSONObject journal)throws VaultFailure{
        try{exact(journal,JOURNAL_KEYS);JSONArray fields=new JSONArray();for(String k:JOURNAL_KEYS)fields.put(journal.get(k));
            return new JSONObject().put("operation_id",c.operation).put("device_id",c.device).put("credential_id",c.credential)
                .put("outcome",c.recovered?"active":"not_required").put("changed",c.recovered)
                .put("transition",c.recovered?"confirmed_recovery":"healthy_no_change").put("journal_schema",JOURNAL)
                .put("journal_binding_sha256",hash(fields.toString())).put("legacy_binding_id",b.id())
                .put("legacy_binding_kind",b.kind()).put("installation_binding_sha256",c.digest);}
        catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}
    }
    private JSONObject read(String key)throws VaultFailure{
        try{String s=store.loadLegacyRecord(key);if(s==null)throw invalid();return new JSONObject(s);}
        catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}
    }
    private void retainExact(String key,JSONObject value)throws VaultFailure{
        String old=store.loadLegacyRecord(key);
        if(old!=null){try{if(!same(new JSONObject(old),value))throw invalid();return;}
            catch(VaultFailure e){throw e;}catch(Exception e){throw invalid(e);}}
        save(key,value);
    }
    private void save(String key,JSONObject value)throws VaultFailure{
        String encoded=value.toString();store.saveLegacyRecord(key,encoded);
        if(!encoded.equals(store.loadLegacyRecord(key)))throw invalid();
    }
    static JSONObject copy(JSONObject v)throws VaultFailure{try{return new JSONObject(v.toString());}catch(Exception e){throw invalid(e);}}
    static boolean same(JSONObject a,JSONObject b)throws VaultFailure{
        if(a.length()!=b.length())return false;
        for(Iterator<String> it=a.keys();it.hasNext();){
            String k=it.next();Object x=a.opt(k),y=b.opt(k);
            if(x instanceof JSONObject&&y instanceof JSONObject){if(!same((JSONObject)x,(JSONObject)y))return false;}
            else if(x instanceof Number&&y instanceof Number){if(((Number)x).doubleValue()!=((Number)y).doubleValue())return false;}
            else if(x==null||!x.equals(y))return false;
        }return true;
    }
    static void exact(JSONObject o,String... keys)throws VaultFailure{
        HashSet<String> actual=new HashSet<>();o.keys().forEachRemaining(actual::add);
        if(!actual.equals(new HashSet<>(Arrays.asList(keys))))throw invalid();
    }
    static String uuid(String s)throws VaultFailure{if(s==null||!s.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))throw invalid();return s;}
    static String hex(String s)throws VaultFailure{if(s==null||!s.matches("[a-f0-9]{64}"))throw invalid();return s;}
    static long epoch(Object v)throws VaultFailure{
        if(!(v instanceof Number))throw invalid();long n=((Number)v).longValue();
        if(n<1||n>9007199254740991L||((Number)v).doubleValue()!=n)throw invalid();return n;
    }
    static String hash(String s)throws VaultFailure{
        try{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder b=new StringBuilder();for(byte v:bytes)b.append(String.format(java.util.Locale.ROOT,"%02x",v&255));return b.toString();}
        catch(Exception e){throw invalid(e);}
    }
    static VaultFailure invalid(){return new VaultFailure(FAILURE);}
    static VaultFailure invalid(Exception e){return new VaultFailure(FAILURE,e);}
}
