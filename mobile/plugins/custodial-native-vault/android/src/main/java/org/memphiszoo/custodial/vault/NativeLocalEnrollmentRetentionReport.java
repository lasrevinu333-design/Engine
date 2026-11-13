package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.json.JSONObject;

/** A spent local-preservation report, read from the native GCM partition
 * journal. It cannot capture an inventory, finalize an enrollment, accept or
 * replay work, retire a key, or authorize assignment. Its fixed native-only
 * transport reports local custody; the named manager owns reassignment.
 * No page/body/path/credential/selected-employee constructor exists. */
final class NativeLocalEnrollmentRetentionReport implements AutoCloseable {
    static final String PATH="/device-auth/local-enrollment-retention";
    static final String SCHEMA="custodial.native-local-enrollment-retention.v1";
    static final String PURPOSE="custodial.native-local-enrollment-retention-purpose.v1";
    static final int MAX_BODY=16384;
    static final String[] FIELDS={"schema","realm_id","previous_realm","inventory_native_request_id","approval_id","operation_id",
        "credential_id","manifest_sha256","local_finalization_intent_document_sha256","local_finalization_intent_disk_sha256",
        "original_native_values_sha256","original_browser_frame_sha256","original_browser_part_set_sha256"};
    private final CustodialEnrollmentApplication application;
    private final NativeRetainedEnrollmentRealmStore store;
    private final NativeRetainedEnrollmentRealmStore.State state;
    private final NativeOriginalInventoryFinalizationIntentData original;
    private final String body,bindingSha,retainedFiles,headSha256;
    private final NativePrivateCustodyFrameReadControl control;
    private final java.nio.file.Path originalRoot;
    private boolean closed;
    private NativeLocalEnrollmentRetentionReport(CustodialEnrollmentApplication application,
        NativeRetainedEnrollmentRealmStore store,NativeRetainedEnrollmentRealmStore.State state,
        NativeOriginalInventoryFinalizationIntentData original,String report,String retainedFiles,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        this.application=application;this.store=store;this.state=state;this.original=original;this.body=report;
        this.retainedFiles=retainedFiles;this.control=control;this.headSha256=store.read().sha256;originalRoot=application.previousOriginalRoot(state,control::check).toPath();
        try{
            var data=ProviderWireJson.object(report.getBytes(StandardCharsets.UTF_8),MAX_BODY);
            NativeRetainedAttempt.keys(data,append(FIELDS,"purpose_binding_sha256","purpose_attestation"));
            bindingSha=bindingSha256(data);
            if(!bindingSha.equals(data.getString("purpose_binding_sha256"))||!data.getString("purpose_attestation").matches("[a-f0-9]{64}")
                ||!state.realm.equals(data.getString("realm_id"))||!state.previousRealm.equals(data.getString("previous_realm"))
                ||!state.operationId.equals(data.getString("operation_id"))||!original.operationId.equals(state.operationId)
                ||!original.durableCommand||!original.storagePartitionId.equals(state.realm)
                ||!original.storagePredecessorRealm.equals(state.previousRealm)||!original.storagePredecessorSha256.equals(state.previousSha256)
                ||!original.inventoryNativeRequestId.equals(data.getString("inventory_native_request_id"))
                ||!original.managerApprovalId.equals(data.getString("approval_id"))
                ||!original.credentialId.equals(data.getString("credential_id"))
                ||!original.valuesSha256.equals(data.getString("original_native_values_sha256"))
                ||!original.browserFrameSha256.equals(data.getString("original_browser_frame_sha256"))
                ||!original.browserPartSetSha256.equals(data.getString("original_browser_part_set_sha256")))throw failure();
            requireCurrent();
        }catch(VaultFailure e){throw e;}catch(Exception e){throw failure();}
    }
    static NativeLocalEnrollmentRetentionReport fromNativeApplication(CustodialEnrollmentApplication application,NativePrivateCustodyFrameReadControl control,String originalOperation)throws VaultFailure {
        NativeOriginalInventoryFinalizationIntentData original=null;byte[] bytes=null;boolean transferred=false;
        try{
            if(application==null||control==null)throw failure();control.check();application.requireStartupPartitionCurrent();
            var store=application.retainedStoreForProtectedRead();var state=application.selectRetainedState(originalOperation,control::check);
            if(NativeRetainedEnrollmentRealmStore.LEGACY.equals(state.realm))throw failure();
            var binding=ProviderWireJson.object(state.binding.getBytes(StandardCharsets.UTF_8),2*1024*1024);
            NativeRetainedAttempt.keys(binding,"schema","original_finalization_intent_utf8","local_retention_report_utf8","retained_original_files_utf8");
            if(!"custodial.local-retained-enrollment-binding.v1".equals(binding.getString("schema")))throw failure();
            bytes=binding.getString("original_finalization_intent_utf8").getBytes(StandardCharsets.UTF_8);
            original=NativeOriginalInventoryFinalizationIntentData.decode(bytes);
            String report=binding.getString("local_retention_report_utf8");var data=new JSONObject(report);
            if(!NativeRetainedAttempt.hash(bytes).equals(data.getString("local_finalization_intent_document_sha256")))throw failure();
            var result=new NativeLocalEnrollmentRetentionReport(application,store,state,original,report,binding.getString("retained_original_files_utf8"),control);
            transferred=true;return result;
        }catch(VaultFailure e){throw e;}catch(Exception e){throw failure();}
        finally{if(bytes!=null)Arrays.fill(bytes,(byte)0);if(!transferred&&original!=null)original.close();}
    }
    static String bindingSha256(JSONObject data)throws VaultFailure {
        try{
            List<String> fields=new ArrayList<>();
            for(String key:FIELDS){Object value=data.get(key);if(!(value instanceof String))throw failure();fields.add((String)value);}
            if(!SCHEMA.equals(data.getString("schema")))throw failure();
            for(String key:new String[]{"realm_id","inventory_native_request_id","approval_id","operation_id","credential_id"})
                uuid(data.getString(key));
            if(!NativeRetainedEnrollmentRealmStore.LEGACY.equals(data.getString("previous_realm")))uuid(data.getString("previous_realm"));
            if(data.getString("previous_realm").equals(data.getString("realm_id")))throw failure();
            for(String key:FIELDS)if(key.endsWith("sha256")&&!data.getString(key).matches("[a-f0-9]{64}"))throw failure();
            return NativeRetainedAttempt.hash(String.join("\n",fields).getBytes(StandardCharsets.UTF_8));
        }catch(VaultFailure e){throw e;}catch(Exception e){throw failure();}
    }
    private void requirePointerCurrent()throws VaultFailure {
        if(closed)throw failure();control.check();application.requireStartupPartitionCurrent();var current=store.read();
        if(!current.sha256.equals(headSha256))throw failure();
        var saved=store.retiredState(state.realm);if(!saved.sha256.equals(state.sha256)||!saved.binding.equals(state.binding))throw failure();
    }
    void requireCurrent()throws VaultFailure {
        requirePointerCurrent();NativeRetainedEnrollmentFiles.requireSame(originalRoot,retainedFiles,control::check);requirePointerCurrent();
    }
    /** Private native transport callback only; never returned through a plugin. */
    char[] originalCredentialForFixedTransport()throws VaultFailure {
        requireCurrent();char[] credential=new AndroidKeystoreCipher().decrypt(original.originalSnapshotForOwningRead().secret);
        try{
            NativeAttestation.requireStoredCredentialId(credential,original.credentialId);
            String expected=NativeAttestation.localEnrollmentRetentionReadSignature(this,credential);
            var value=new JSONObject(body);
            if(!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),value.getString("purpose_attestation").getBytes(StandardCharsets.US_ASCII)))throw failure();
            requireCurrent();char[] result=credential;credential=null;return result;
        }catch(VaultFailure e){throw e;}catch(Exception e){throw failure();}
        finally{VaultValidation.wipe(credential);}
    }
    JSONObject verifyRetainedOriginals()throws VaultFailure {
        char[] credential=null;
        try{
            credential=originalCredentialForFixedTransport();requireCurrent();
            var metadata=original.originalSnapshotForOwningRead().metadata;
            return new JSONObject().put("schema","custodial.local-retained-enrollment-verification.v1")
                .put("archive_bytes_compared",true).put("original_encrypted_credential_readable",true)
                .put("original_employee_id",original.employeeId).put("original_employee_name",metadata.employeeName)
                .put("original_operation_id",original.operationId).put("work_accepted",false)
                .put("key_removal",false).put("new_work_authority",false).put("phone_assignment_changed",false);
        }catch(VaultFailure e){throw e;}catch(Exception e){throw failure();}
        finally{VaultValidation.wipe(credential);}
    }
    String credentialForFixedRetentionReadSigner()throws VaultFailure {requirePointerCurrent();return original.credentialId;}
    String messageForFixedRetentionReadSigner()throws VaultFailure {requirePointerCurrent();return PURPOSE+"\n"+original.credentialId+"\n"+bindingSha;}
    String deviceForFixedTransport()throws VaultFailure {requirePointerCurrent();return original.deviceId;}
    String realmForFixedReceipt()throws VaultFailure {requirePointerCurrent();return state.realm;}
    String operationForFixedReceipt()throws VaultFailure {requirePointerCurrent();return state.operationId;}
    AuthorizedRequest requestForFixedTransport(char[] credential,long nowMillis)throws VaultFailure {
        requireCurrent();NativeAttestation.requireStoredCredentialId(credential,original.credentialId);
        byte[] bytes=body.getBytes(StandardCharsets.UTF_8);if(bytes.length<1||bytes.length>MAX_BODY)throw failure();
        var unsigned=new AuthorizedRequest(PATH,"POST",Map.of(),bytes);
        var headers=NativeAttestation.requestHeaders(unsigned,original.deviceId,credential,state.realm,nowMillis);
        requireCurrent();return new AuthorizedRequest(PATH,"POST",headers,bytes);
    }
    @Override public void close(){closed=true;original.close();}
    private static String[] append(String[] fields,String... additional){List<String> keys=new ArrayList<>(List.of(fields));keys.addAll(List.of(additional));return keys.toArray(new String[0]);}
    private static void uuid(String value)throws VaultFailure {if(value==null||!value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"))throw failure();}
    private static VaultFailure failure(){return new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);}
}
