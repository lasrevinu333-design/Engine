package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import org.json.JSONObject;

/** Synthetic archived DATA + actual target/codec only; no control, key,
 * GCM authentication, native manager/browser issuer or effect authority. */
public final class NativeOriginalInventoryFinalizationIntentDataTest {
    private static final String OP="11111111-1111-4111-8111-111111111111";
    private static final String ENROLL="22222222-2222-4222-8222-222222222222";
    private static final String EMPLOYEE="33333333-3333-4333-8333-333333333333";
    private static final String CREDENTIAL="44444444-4444-4444-8444-444444444444";
    private static final String[] TARGET={"operation_id","separation_id","separation_authority_revision","canonical_device_pk",
        "canonical_device_id","employee_id","credential_id","assignment_epoch","original_generation_id","original_credential_secret_key_id",
        "principal_digest","engine_revision","original_wire_sha256","original_frozen_work_sha256","capsule_sha256","record_sha256",
        "frame_sha256","plan_sha256","aad_binding_sha256","source_capture_sha256","values_sha256","semantic_join_sha256","layout_sha256"};
    private static final Set<String> UUIDS=Set.of("operation_id","separation_id","canonical_device_pk","employee_id","credential_id","original_generation_id");
    private static final VaultSnapshotCodec CODEC=new VaultSnapshotCodec();
    private static void check(boolean value)throws Exception {if(!value)throw new AssertionError("New DATA fixture check failed");}
    private static final class Fixture {
        final VaultSnapshot original,terminal;final JSONObject target=new JSONObject(),fixed=new JSONObject(),document=new JSONObject();
        Fixture()throws Exception {
            original=new VaultSnapshot(7,VaultPhase.ACTIVE,SecretKind.DEVICE_CREDENTIAL,
                new EncryptedSecret("SYNTHETIC_CIPHERTEXT_NOT_A_CREDENTIAL","SYNTHETIC_IV_NOT_A_KEY"),ENROLL,"KIOSK_02","enrollment",0,
                new InstallationBinding("KIOSK_02","installation-seal-0002","2026-01-01T00:00:00.000Z",false,ENROLL),
                new EnrollmentMetadata(CREDENTIAL,"","","Synthetic device",EMPLOYEE,"Synthetic employee"),"","",false,"");
            terminal=original.next(VaultPhase.EMPTY,SecretKind.NONE,null,"",original.deviceId,"",0,null,EnrollmentMetadata.empty(),OP,"",false,"");
            for(String key:TARGET)target.put(key,UUIDS.contains(key)?OP:
                key.equals("canonical_device_id")?"KIOSK_02":key.equals("engine_revision")?"7":
                Set.of("assignment_epoch","separation_authority_revision").contains(key)?"1":"a".repeat(64));
            target.put("credential_id",CREDENTIAL).put("employee_id",EMPLOYEE);
            // Existing closed parser validates the ACTUAL 23-field fixture.
            NativeSameOriginalRecoveryPreparationWire.decodeTarget(target.toString().getBytes(StandardCharsets.UTF_8)).json();
            fixed.put("schema","custodial.original-inventory-enrollment-finalization-intent.v2")
                .put("state","ORIGINAL_LOCAL_ENROLLMENT_TRANSITION_OUTCOME_UNKNOWN").put("original_target",target);
            for(String key:new String[]{"inventory_manifest_sha256","registration_receipt_sha256","original_decision_disk_sha256",
                "original_decision_document_sha256","original_decision_response_sha256","original_native_values_sha256",
                "original_browser_frame_sha256","original_browser_part_set_sha256"})fixed.put(key,"a".repeat(64));
            fixed.put("original_vault_revision","7").put("terminal_vault_revision","8");
            snapshot(fixed,"original",CODEC.encode(original));snapshot(fixed,"terminal",CODEC.encode(terminal));
            fixed.put("keep_all_original_work",true).put("keep_all_existing_keys",true)
                .put("work_accepted",false).put("resend_allowed",false).put("phone_released",false);
            document.put("schema","custodial.native-private-custody-exchange-evidence.v1")
                .put("entry_key","inventory_finalization_intent-0").put("operation_id",OP).put("plan_sha256","a".repeat(64))
                .put("finalization",fixed);
        }
        byte[] bytes(){return document.toString().getBytes(StandardCharsets.UTF_8);}
    }
    private static void snapshot(JSONObject fixed,String which,byte[] bytes)throws Exception {
        fixed.put(which+"_vault_snapshot_base64",NativeRetainedAttempt.encodeBase64(bytes));
        fixed.put(which+"_vault_snapshot_sha256",NativeRetainedAttempt.hash(bytes));
    }
    private static void denied(byte[] bytes)throws Exception {
        byte[] before=bytes==null?null:bytes.clone();
        try(var data=NativeOriginalInventoryFinalizationIntentData.decode(bytes)){throw new AssertionError("Hostile archived DATA accepted");}
        catch(VaultFailure failure){check(NativeOriginalInventoryFinalizationIntentData.FAILURE.equals(failure.code));}
        check(Arrays.equals(before,bytes));
    }
    private static void denied(Fixture f)throws Exception {denied(f.bytes());}
    private static void roundtrip()throws Exception {
        Fixture f=new Fixture();byte[] bytes=(" \n"+f.document.toString()+"\t\n").getBytes(StandardCharsets.UTF_8),before=bytes.clone();
        var data=NativeOriginalInventoryFinalizationIntentData.decode(bytes);
        check(Arrays.equals(bytes,before));check(data.originalSnapshotForOwningRead().equals(f.original));
        check(data.terminalSnapshotForOwningRead().equals(f.terminal));
        check(data.operationId.equals(OP)&&data.planSha256.equals("a".repeat(64))&&data.originalRevision==7&&data.terminalRevision==8);
        check(data.originalGenerationId.equals(f.target.getString("original_generation_id"))&&data.valuesSha256.equals("a".repeat(64)));
        check(data.browserFrameSha256.equals("a".repeat(64))&&data.browserPartSetSha256.equals("a".repeat(64)));
        check(data.deviceId.equals("KIOSK_02")&&data.credentialId.equals(CREDENTIAL)&&data.employeeId.equals(EMPLOYEE));
        check(data.separationId.equals(f.target.getString("separation_id"))&&data.principalDigest.equals("a".repeat(64)));
        check(Arrays.equals(CODEC.encode(data.originalSnapshotForOwningRead()),CODEC.encode(f.original)));
        check(data.originalSnapshotForOwningRead().secret.ciphertext.equals(f.original.secret.ciphertext));
        Arrays.fill(bytes,(byte)0);check(data.originalSnapshotForOwningRead().equals(f.original));
        data.close();data.close();
        try{data.originalSnapshotForOwningRead();throw new AssertionError("Closed original returned");}
        catch(VaultFailure failure){check(failure.code.equals(NativeOriginalInventoryFinalizationIntentData.FAILURE));}
        try{data.terminalSnapshotForOwningRead();throw new AssertionError("Closed terminal returned");}
        catch(VaultFailure failure){check(failure.code.equals(NativeOriginalInventoryFinalizationIntentData.FAILURE));}
    }
    private static void structure()throws Exception {
        Fixture old=new Fixture();old.fixed.put("schema","custodial.original-inventory-enrollment-finalization-intent.v1");denied(old);
        for(String key:new String[]{"original_vault_snapshot_base64","terminal_vault_snapshot_base64","original_target","keep_all_existing_keys"}){
            Fixture f=new Fixture();f.fixed.remove(key);denied(f);
        }
        Fixture extra=new Fixture();extra.fixed.put("caller_permission",true);denied(extra);
        Fixture outer=new Fixture();outer.document.put("extra","unknown");denied(outer);
        Fixture schema=new Fixture();schema.document.put("schema","foreign");denied(schema);
        Fixture entry=new Fixture();entry.document.put("entry_key","inventory_finalization_intent-1");denied(entry);
        for(String key:new String[]{"keep_all_original_work","keep_all_existing_keys","work_accepted","resend_allowed","phone_released"}){
            Fixture f=new Fixture();f.fixed.put(key,!f.fixed.getBoolean(key));denied(f);
            Fixture typed=new Fixture();typed.fixed.put(key,String.valueOf(typed.fixed.getBoolean(key)));denied(typed);
        }
        Fixture numeric=new Fixture();numeric.fixed.put("original_vault_revision",7);denied(numeric);
        Fixture targetType=new Fixture();targetType.fixed.put("original_target","not an object");denied(targetType);
        Fixture finalType=new Fixture();finalType.document.put("finalization",false);denied(finalType);
    }
    private static void parser()throws Exception {
        String text=new String(new Fixture().bytes(),StandardCharsets.UTF_8);
        denied(("{\"entry_key\":\"inventory_finalization_intent-0\","+text.substring(1)).getBytes(StandardCharsets.UTF_8));
        denied(("{\"entry_\\u006bey\":\"inventory_finalization_intent-0\","+text.substring(1)).getBytes(StandardCharsets.UTF_8));
        denied((text+" {}").getBytes(StandardCharsets.UTF_8));denied(new byte[]{(byte)0xc3,0x28});
        denied(new byte[NativeOriginalInventoryFinalizationIntentData.MAX_DOCUMENT+1]);denied(new byte[0]);denied((byte[])null);
        Fixture badSha=new Fixture();badSha.fixed.put("original_browser_frame_sha256","A".repeat(64));denied(badSha);
        Fixture typeSha=new Fixture();typeSha.document.put("plan_sha256",false);denied(typeSha);
        Fixture badTarget=new Fixture();badTarget.target.put("extra","unknown");denied(badTarget);
    }
    private static void integrity()throws Exception {
        Fixture digest=new Fixture();digest.fixed.put("original_vault_snapshot_sha256","b".repeat(64));denied(digest);
        Fixture terminalDigest=new Fixture();terminalDigest.fixed.put("terminal_vault_snapshot_sha256","b".repeat(64));denied(terminalDigest);
        for(String suffix:new String[]{" ","\n"}){
            Fixture f=new Fixture();f.fixed.put("original_vault_snapshot_base64",f.fixed.getString("original_vault_snapshot_base64")+suffix);denied(f);
        }
        Fixture huge=new Fixture();snapshot(huge.fixed,"original",new byte[65537]);denied(huge);
        Fixture trailing=new Fixture();byte[] raw=CODEC.encode(trailing.original);snapshot(trailing.fixed,"original",Arrays.copyOf(raw,raw.length+1));denied(trailing);
        Fixture normalized=new Fixture();byte[] altered=CODEC.encode(normalized.original),needle="Synthetic device".getBytes(StandardCharsets.UTF_8);
        int at=-1;
        for(int i=0;i<=altered.length-needle.length;i++)if(Arrays.equals(Arrays.copyOfRange(altered,i,i+needle.length),needle)){at=i;break;}
        check(at>=0);altered[at+needle.length-1]=' ';
        check(!Arrays.equals(altered,CODEC.encode(CODEC.decode(altered)))); // real codec normalization prerequisite
        snapshot(normalized.fixed,"original",altered);denied(normalized);
        Fixture pads=new Fixture();String value=pads.fixed.getString("terminal_vault_snapshot_base64");
        pads.fixed.put("terminal_vault_snapshot_base64",value.substring(0,value.length()-1));denied(pads);
    }
    private static void bindings()throws Exception {
        for(String key:new String[]{"operation_id","plan_sha256"}){
            Fixture f=new Fixture();f.document.put(key,key.equals("operation_id")?ENROLL:"b".repeat(64));denied(f);
        }
        for(String key:new String[]{"operation_id","plan_sha256","engine_revision","canonical_device_id","credential_id","employee_id"}){
            Fixture f=new Fixture();f.target.put(key,key.equals("engine_revision")?"8":key.equals("canonical_device_id")?"KIOSK_03":
                key.equals("plan_sha256")?"b".repeat(64):ENROLL);denied(f);
        }
        Fixture values=new Fixture();values.fixed.put("original_native_values_sha256","b".repeat(64));denied(values);
        for(String revision:new String[]{"-1","+7","07","7.0","9223372036854775807","9223372036854775808"}){
            Fixture f=new Fixture();f.fixed.put("original_vault_revision",revision);denied(f);
        }
        Fixture wrongTarget=new Fixture();wrongTarget.target.put("engine_revision","9007199254740992");denied(wrongTarget);
    }
    private static void terminal()throws Exception {
        Fixture active=new Fixture();snapshot(active.fixed,"terminal",CODEC.encode(active.original));denied(active);
        Fixture wrongRevision=new Fixture();wrongRevision.fixed.put("terminal_vault_revision","9");denied(wrongRevision);
        Fixture metadata=new Fixture();VaultSnapshot old=metadata.terminal;
        VaultSnapshot changed=new VaultSnapshot(old.revision,old.phase,old.secretKind,old.secret,old.operationId,old.deviceId,
            old.flow,old.expiresAtMillis,old.installation,metadata.original.metadata,old.removalOperationId,old.blockedReason,old.legacyHadBinding,old.legacySeal);
        snapshot(metadata.fixed,"terminal",CODEC.encode(changed));denied(metadata);
        Fixture operation=new Fixture();VaultSnapshot swapped=operation.original.next(VaultPhase.EMPTY,SecretKind.NONE,null,"",
            operation.original.deviceId,"",0,null,EnrollmentMetadata.empty(),ENROLL,"",false,"");
        snapshot(operation.fixed,"terminal",CODEC.encode(swapped));denied(operation);
        Fixture secret=new Fixture();byte[] raw=CODEC.encode(secret.terminal);
        // Alter codec string #1 (secret kind) while preserving every other
        // original byte. This is hostile DATA, never a valid owning snapshot.
        int firstLength=ByteBuffer.wrap(raw,16,4).getInt(),offset=20+firstLength,length=ByteBuffer.wrap(raw,offset,4).getInt();
        byte[] name="DEVICE_CREDENTIAL".getBytes(StandardCharsets.UTF_8),forged=new byte[raw.length+name.length-length];
        System.arraycopy(raw,0,forged,0,offset);ByteBuffer.wrap(forged,offset,4).putInt(name.length);
        System.arraycopy(name,0,forged,offset+4,name.length);
        System.arraycopy(raw,offset+4+length,forged,offset+4+name.length,raw.length-offset-4-length);
        snapshot(secret.fixed,"terminal",forged);denied(secret);
    }
    public static void main(String[] args)throws Exception {
        if(args.length!=1||!args[0].startsWith("--case="))throw new IllegalArgumentException("One new decoder DATA case only");
        String name=args[0].substring(7);
        switch(name){case "roundtrip"->roundtrip();case "structure"->structure();case "parser"->parser();
            case "integrity"->integrity();case "bindings"->bindings();case "terminal"->terminal();
            default->throw new IllegalArgumentException("Unknown new DATA case");}
        System.out.println("PASS_NEW_FINALIZATION_INTENT_DATA "+name);
        System.out.println("SYNTHETIC_ARCHIVED_DATA_ONLY; GCM_CURRENT_HELD_MANAGER_RESTART_EFFECT_ACK_NOT_RUN");
    }
}
