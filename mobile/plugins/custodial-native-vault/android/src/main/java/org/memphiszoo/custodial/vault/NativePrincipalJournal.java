package org.memphiszoo.custodial.vault;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.json.JSONObject;

/** Last authenticated assignment, bound to this protected credential/installation.
 * No WebView setter; only an actual native HTTPS status response may advance it.
 */
final class NativePrincipalJournal {
    static final String FAILURE="custodial_native_principal_mismatch";
    interface Store {
        String loadPrincipal() throws VaultFailure;
        void savePrincipal(String encoded) throws VaultFailure;
    }
    private final Store store;
    private static final Object LOCK=new Object();
    NativePrincipalJournal(Store store){this.store=store;}
    static boolean isStatus(AuthorizedRequest request){
        try{return "GET".equals(request.method)&&"/device-auth/status".equals(new URI(request.path).getPath());}
        catch(Exception e){return false;}
    }
    synchronized void capture(Map<String,Object> state,AuthorizedRequest request,AuthorizedResponse response) throws VaultFailure {
        if(!isStatus(request)||response.status!=200)return;
        synchronized(LOCK){
        try{
            JSONObject envelope=new JSONObject(new String(response.body,StandardCharsets.UTF_8));
            JSONObject data=envelope.getJSONObject("data"),principal=context(state);
            if(!Boolean.TRUE.equals(envelope.opt("ok"))||!Boolean.TRUE.equals(data.opt("authenticated")))throw new VaultFailure(FAILURE);
            if(!principal.getString("device_id").equals(data.getString("canonical_device_id"))
                ||!principal.getString("credential_id").equals(data.getString("credential_id")))throw new VaultFailure(FAILURE);
            String employee=uuid(data.getString("employee_id"));
            Object rawEpoch=data.get("assignment_epoch");
            if(!(rawEpoch instanceof Number))throw new VaultFailure(FAILURE);
            long epoch=((Number)rawEpoch).longValue();
            if(epoch<=0||epoch>9007199254740991L||((Number)rawEpoch).doubleValue()!=epoch)throw new VaultFailure(FAILURE);
            principal.put("employee_id",employee).put("assignment_epoch",epoch);
            String old=store.loadPrincipal();
            if(old!=null){
                JSONObject previous=new JSONObject(old);
                if(previous.getString("device_id").equals(principal.getString("device_id"))
                    &&previous.getString("installation_seal").equals(principal.getString("installation_seal"))){
                    long before=previous.getLong("assignment_epoch");
                    if(epoch<before||(epoch==before&&!employee.equals(previous.getString("employee_id"))))throw new VaultFailure(FAILURE);
                }
            }
            String encoded=principal.toString();store.savePrincipal(encoded);
            if(!encoded.equals(store.loadPrincipal()))throw new VaultFailure(FAILURE);
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
        }
    }
    synchronized JSONObject readFor(Map<String,Object> state) throws VaultFailure {
        synchronized(LOCK){
        if(!Boolean.TRUE.equals(state.get("active")))return null;
        String encoded=store.loadPrincipal();if(encoded==null)return null;
        try{
            JSONObject expected=context(state),actual=new JSONObject(encoded);
            for(java.util.Iterator<String> keys=expected.keys();keys.hasNext();){
                String key=keys.next();if(!expected.get(key).equals(actual.opt(key)))return null;
            }
            if(actual.length()!=expected.length()+2||actual.getLong("assignment_epoch")<=0)throw new VaultFailure(FAILURE);
            uuid(actual.getString("employee_id"));return actual;
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
        }
    }
    private static JSONObject context(Map<String,Object> state) throws Exception {
        JSONObject s=new JSONObject(state),installation=s.getJSONObject("installation");
        if(!Boolean.TRUE.equals(s.opt("active")))throw new VaultFailure(FAILURE);
        return new JSONObject().put("schema_version","custodial-protected-principal.v1")
            .put("device_id",VaultValidation.deviceId(installation.getString("device_id")))
            .put("credential_id",uuid(s.getString("active_credential_id")))
            .put("credential_operation_id",VaultValidation.operationId(s.getString("active_enrollment_operation_id")))
            .put("installation_seal",installation.getString("installation_seal"))
            .put("enrolled_at",installation.getString("enrolled_at"));
    }
    private static String uuid(String value) throws VaultFailure {
        if(value==null||!value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))throw new VaultFailure(FAILURE);
        return value;
    }
}
