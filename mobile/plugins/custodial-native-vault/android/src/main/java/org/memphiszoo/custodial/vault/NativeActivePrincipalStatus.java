package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/** Native authenticated GET status validation for CHECK_PENDING recovery only.
 * Validation alone is not authentication and produces no persistent authority,
 * inventory ACK, separation cancellation or phone-reuse permission. */
final class NativeActivePrincipalStatus {
    static final String PATH="/device-auth/status";
    static final String FAILURE="custodial_native_active_principal_unverified";
    static void require(AuthorizedRequest request,AuthorizedResponse response,NativeProviderPrincipal principal)throws VaultFailure{
        try{
            if(request==null||response==null||principal==null||!PATH.equals(request.path)
                ||!"GET".equals(request.method)||request.body.length!=0||response.status!=200)throw new VaultFailure(FAILURE);
            JSONObject envelope=ProviderWireJson.object(response.body,32768);
            keys(envelope,"ok","data");
            if(!Boolean.TRUE.equals(envelope.get("ok")))throw new VaultFailure(FAILURE);
            JSONObject data=envelope.getJSONObject("data"),expected=principal.json();
            keys(data,"authenticated","enrollment_required","recovery_required","policy_mode","requested_device_id",
                "canonical_device_id","device_name","employee_name","employee_id","assignment_epoch","employee_role",
                "credential_id","credential_expires_at");
            if(!Boolean.TRUE.equals(data.get("authenticated"))||!Boolean.FALSE.equals(data.get("enrollment_required"))
                ||!Boolean.FALSE.equals(data.get("recovery_required")))throw new VaultFailure(FAILURE);
            for(String field:new String[]{"employee_id","credential_id"})
                if(!expected.get(field).equals(data.get(field)))throw new VaultFailure(FAILURE);
            if(!expected.get("device_id").equals(data.get("canonical_device_id"))
                ||!expected.get("device_id").equals(data.get("requested_device_id")))throw new VaultFailure(FAILURE);
            Object epoch=data.get("assignment_epoch");
            if(!(epoch instanceof Integer||epoch instanceof Long)||((Number)epoch).longValue()!=expected.getLong("assignment_epoch"))
                throw new VaultFailure(FAILURE);
            if(!(data.get("policy_mode") instanceof String))throw new VaultFailure(FAILURE);
            for(String field:new String[]{"device_name","employee_name","employee_role","credential_expires_at"}){
                Object value=data.get(field);if(value!=JSONObject.NULL&&!(value instanceof String))throw new VaultFailure(FAILURE);
            }
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }
    private static void keys(JSONObject value,String... required)throws VaultFailure{
        Set<String> actual=new HashSet<>();for(java.util.Iterator<String> it=value.keys();it.hasNext();)actual.add(it.next());
        if(!actual.equals(new HashSet<>(Arrays.asList(required))))throw new VaultFailure(FAILURE);
    }
    private NativeActivePrincipalStatus(){}
}
