package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.Arrays;
import org.json.JSONObject;
import org.junit.Test;

/** NEW owning returned-byte crypto seam ONLY. Reflection reads synthetic
 * TEST bytes, never credentials/keys/user records. No HTTP/SQL/provider,
 * all-writer freeze, Android runtime, namespace ACK or physical claim. */
public final class NativePrivateCustodyReturnedFrameTest {
    public static void main(String[] args)throws Exception {
        if(args.length!=2||!"--returned-frame-validation-boundary-only".equals(args[0])
            ||!java.util.Set.of("RETURN_BOUNDARY_unchangedOwnedFrameIsDetachedDataOnly",
                "RETURN_BOUNDARY_originalKeyWithdrawalKeepsCiphertext",
                "RETURN_BOUNDARY_sourceWithdrawalDuringKeyCheckRefuses",
                "RETURN_BOUNDARY_originalFileClosedPlanAndForeignEngineRefuse").contains(args[1]))
            throw new IllegalArgumentException("new_returned_frame_boundary_member_required");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyReturnedFrameTest.class,args[1]));
        if(result.getRunCount()!=1||!result.wasSuccessful()){
            for(var failure:result.getFailures())failure.getException().printStackTrace(System.err);
            throw new AssertionError("returned_frame_boundary_selected_case_failed");
        }
        System.out.println("PASS_NEW_RETURNED_FRAME_BOUNDARY_SOURCE_ONLY "+args[1]);
    }
    // NEW cases use the existing guarded operation constructor, not the old
    // unguarded Fixture or historical @Test methods as prerequisites.
    private static byte[] boundaryFrame(NativePrivateCustodyOperationTest.Fixture x)throws Exception {
        return((byte[])NativePrivateCustodyExchangeTest.field(x.frame,"encoded")).clone();
    }
    private static Object boundaryKey(java.nio.file.Path path)throws Exception {
        return java.nio.file.Files.readAttributes(path,java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();
    }
    @Test public void RETURN_BOUNDARY_unchangedOwnedFrameIsDetachedDataOnly()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture(true);var operation=x.prepare();
            var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(operation)){
            var capsule=NativePrivateCustodyOwnerTest.files(x.f.dir);var savedOperation=NativePrivateCustodyOwnerTest.files(x.dir);
            Object capsuleKey=boundaryKey(x.f.committed),operationKey=boundaryKey(x.committed);byte[] input=boundaryFrame(x);
            try(var observed=x.f.engine().inspectUntrustedReturnedOriginalPrivateCustodyFrame(plan,input)){
                var first=observed.projection();String exact=first.toString();noAuthority(first);
                assertTrue(plan.projection().getInt("chunk_count")>1);
                assertEquals(plan.projection().get("plan_sha256"),first.get("plan_sha256"));
                assertEquals(x.frame.metadata().get("frame_sha256"),first.get("returned_frame_sha256"));
                byte[] owned=(byte[])NativePrivateCustodyExchangeTest.field(observed,"returned");assertNotSame(input,owned);
                input[0]^=1;first.put("work_accepted",true).put("returned_frame_sha256","0".repeat(64));
                var second=observed.projection();assertTrue(ProviderWireJson.same(new JSONObject(exact),second));noAuthority(second);
                observed.close();observed.close();assertArrayEquals(new byte[owned.length],owned);denied(observed::projection);
                plan.projection(); // closing owned returned bytes never closes the original plan
                NativePrivateCustodyOwnerTest.sameFiles(capsule,x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(savedOperation,x.dir);
                assertEquals(capsuleKey,boundaryKey(x.f.committed));assertEquals(operationKey,boundaryKey(x.committed));
                assertFalse(java.nio.file.Files.exists(x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)));
            }finally{Arrays.fill(input,(byte)0);for(byte[] bytes:capsule.values())Arrays.fill(bytes,(byte)0);for(byte[] bytes:savedOperation.values())Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void RETURN_BOUNDARY_originalKeyWithdrawalKeepsCiphertext()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture(true);var operation=x.prepare();
            var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(operation)){
            var capsule=NativePrivateCustodyOwnerTest.files(x.f.dir);var savedOperation=NativePrivateCustodyOwnerTest.files(x.dir);
            Object capsuleKey=boundaryKey(x.f.committed),operationKey=boundaryKey(x.committed);byte[] input=boundaryFrame(x);
            try(var observed=x.f.engine().inspectUntrustedReturnedOriginalPrivateCustodyFrame(plan,input)){
                noAuthority(observed.projection());
                NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);
                denied(observed::projection);denied(()->x.f.engine().inspectUntrustedReturnedOriginalPrivateCustodyFrame(plan,input));
                NativePrivateCustodyOwnerTest.sameFiles(capsule,x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(savedOperation,x.dir);
                assertEquals(capsuleKey,boundaryKey(x.f.committed));assertEquals(operationKey,boundaryKey(x.committed));
            }finally{Arrays.fill(input,(byte)0);for(byte[] bytes:capsule.values())Arrays.fill(bytes,(byte)0);for(byte[] bytes:savedOperation.values())Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void RETURN_BOUNDARY_sourceWithdrawalDuringKeyCheckRefuses()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture(true);var operation=x.prepare();
            var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(operation)){
            var capsule=NativePrivateCustodyOwnerTest.files(x.f.dir);var savedOperation=NativePrivateCustodyOwnerTest.files(x.dir);
            Object capsuleKey=boundaryKey(x.f.committed),operationKey=boundaryKey(x.committed);byte[] input=boundaryFrame(x);
            try(var observed=x.f.engine().inspectUntrustedReturnedOriginalPrivateCustodyFrame(plan,input)){
                noAuthority(observed.projection());int[] callbacks={0};
                var source=x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");
                NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,(Runnable)()->{
                    callbacks[0]++;source.put("returned-boundary-withdrawn-source","synthetic retained unknown");
                });
                denied(observed::projection);assertEquals(1,callbacks[0]);
                assertEquals("synthetic retained unknown",source.get("returned-boundary-withdrawn-source"));
                NativePrivateCustodyOwnerTest.sameFiles(capsule,x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(savedOperation,x.dir);
                assertEquals(capsuleKey,boundaryKey(x.f.committed));assertEquals(operationKey,boundaryKey(x.committed));
            }finally{Arrays.fill(input,(byte)0);for(byte[] bytes:capsule.values())Arrays.fill(bytes,(byte)0);for(byte[] bytes:savedOperation.values())Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void RETURN_BOUNDARY_originalFileClosedPlanAndForeignEngineRefuse()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.Fixture(true);var operation=x.prepare();
            var plan=x.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(operation)){
            var capsule=NativePrivateCustodyOwnerTest.files(x.f.dir);var savedOperation=NativePrivateCustodyOwnerTest.files(x.dir);
            Object capsuleKey=boundaryKey(x.f.committed),operationKey=boundaryKey(x.committed);byte[] input=boundaryFrame(x);
            try(var observed=x.f.engine().inspectUntrustedReturnedOriginalPrivateCustodyFrame(plan,input)){
                noAuthority(observed.projection());
                var held=x.f.root.resolve("returned-boundary-original-operation");var replacement=x.f.root.resolve("returned-boundary-equal-operation");
                var attributes=java.nio.file.Files.readAttributes(x.committed,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                java.nio.file.Files.createLink(held,x.committed);
                try{
                    java.nio.file.Files.copy(x.committed,replacement);java.nio.file.Files.setPosixFilePermissions(replacement,attributes.permissions());
                    java.nio.file.Files.setLastModifiedTime(replacement,attributes.lastModifiedTime());
                    java.nio.file.Files.move(replacement,x.committed,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    assertNotEquals(operationKey,boundaryKey(x.committed));
                    denied(observed::projection);assertArrayEquals(savedOperation.get(NativePrivateCustodyOperationStore.COMMITTED),java.nio.file.Files.readAllBytes(held));
                }finally{java.nio.file.Files.move(held,x.committed,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);}
                plan.close();denied(observed::projection);
                denied(()->x.f.engine().inspectUntrustedReturnedOriginalPrivateCustodyFrame(null,input));
                var foreign=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();
                try{denied(()->foreign.f.engine().inspectUntrustedReturnedOriginalPrivateCustodyFrame(plan,input));}
                finally{foreign.f.x.f.preserved();}
                NativePrivateCustodyOwnerTest.sameFiles(capsule,x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(savedOperation,x.dir);
                assertEquals(capsuleKey,boundaryKey(x.f.committed));assertEquals(operationKey,boundaryKey(x.committed));
            }finally{Arrays.fill(input,(byte)0);for(byte[] bytes:capsule.values())Arrays.fill(bytes,(byte)0);for(byte[] bytes:savedOperation.values())Arrays.fill(bytes,(byte)0);}
        }
    }
    static final class Fixture implements AutoCloseable {
        final NativePrivateCustodyOperationTest.Fixture x=new NativePrivateCustodyOperationTest.Fixture();
        final VaultEngine engine=x.f.engine();
        final VaultEngine.NativePrivateCustodyOperationObservation operation=x.prepare();
        final VaultEngine.NativePrivateCustodyChunkIdentityPlan plan=engine.prepareOriginalPrivateCustodyChunkIdentityPlan(operation);
        Fixture()throws Exception{}
        byte[] bytes()throws Exception{return ((byte[])NativePrivateCustodyExchangeTest.field(x.frame,"encoded")).clone();}
        VaultEngine.NativePrivateCustodyReturnedFrameObservation inspect(byte[] bytes)throws Exception{return engine.inspectUntrustedReturnedOriginalPrivateCustodyFrame(plan,bytes);}
        @Override public void close(){plan.close();operation.close();x.close();}
    }
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception {NativePrivateCustodyOwnerTest.denied(action);}
    static void noAuthority(JSONObject p)throws Exception {
        for(String key:new String[]{"transport_origin_authenticated","current_SQL_snapshot_frame_readback","current_server_readback","writer_authority","durable_retention",
            "raw_byte_record_or_credential_getter","original_saved_records_or_queries_modified","replacement_key_IV_signature_operation_or_query_created",
            "application_values_applied_or_semantically_accepted","complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","actual_Android_storage_qualified","actual_Android_keystore_qualified",
            "inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(key,p.getBoolean(key));
        assertTrue(p.getBoolean("input_is_untrusted_until_fixed_transport_and_SQL_source_bound"));
        assertTrue(p.getBoolean("existing_original_device_key_GCM_all_value_chunks_verified"));
        assertTrue(p.getBoolean("exact_original_all8_values_compared_in_native_only"));
        for(String text:new String[]{"frame_base64","record_base64","ciphertext","response_base64","SYNTHETIC_LONG_DEVICE_SECRET_SOURCE_OWNER"})assertFalse(p.toString().contains(text));
    }
    @Test public void originalMultiChunkBytesVerifyExistingKeyValuesButCannotAuthenticateServerSource()throws Exception {try(var f=new Fixture()){
        byte[] bytes=f.bytes();try(var observed=f.inspect(bytes)){var p=observed.projection();noAuthority(p);assertTrue(f.plan.projection().getInt("chunk_count")>1);
            assertEquals(f.plan.projection().get("operation_id"),p.get("operation_id"));assertEquals(f.plan.projection().get("plan_sha256"),p.get("plan_sha256"));
            assertEquals(f.x.frame.metadata().get("frame_sha256"),p.get("returned_frame_sha256"));assertEquals(bytes.length,p.getInt("returned_frame_bytes"));
        }finally{Arrays.fill(bytes,(byte)0);}
    }}
    @Test public void verificationNeverCreatesRequestQueryUnknownOrObservationFiles()throws Exception {try(var f=new Fixture()){
        var original=NativePrivateCustodyOwnerTest.files(f.x.f.dir);var operation=NativePrivateCustodyOwnerTest.files(f.x.dir);
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);byte[] bytes=f.bytes();
        try(var observed=f.inspect(bytes)){observed.projection();observed.projection();NativePrivateCustodyOwnerTest.sameFiles(original,f.x.f.dir);NativePrivateCustodyOwnerTest.sameFiles(operation,f.x.dir);stable.check();}
        finally{Arrays.fill(bytes,(byte)0);}assertFalse(java.nio.file.Files.exists(f.x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)));
    }}
    @Test public void inputIsCopiedAndCloseWipesOnlyOwnedReturnedBytes()throws Exception {try(var f=new Fixture()){
        byte[] input=f.bytes();var observed=f.inspect(input);byte[] owned=(byte[])NativePrivateCustodyExchangeTest.field(observed,"returned");
        input[0]^=1;noAuthority(observed.projection());assertNotSame(input,owned);observed.close();assertArrayEquals(new byte[owned.length],owned);
        assertNull(NativePrivateCustodyExchangeTest.field(observed,"returned"));denied(observed::projection);f.plan.projection();f.x.frame.metadata();Arrays.fill(input,(byte)0);
    }}
    @Test public void partialForeignAndMalformedBytesCannotBePromotedOrRepaired()throws Exception {try(var f=new Fixture()){
        byte[] original=f.bytes();var files=NativePrivateCustodyOwnerTest.files(f.x.dir);
        try {denied(()->f.inspect(null));denied(()->f.inspect(new byte[0]));denied(()->f.inspect(Arrays.copyOf(original,original.length-1)));
            for(int position:new int[]{0,8,140,original.length-40,original.length-1}){byte[] changed=original.clone();changed[position]^=1;denied(()->f.inspect(changed));Arrays.fill(changed,(byte)0);}
            NativePrivateCustodyOwnerTest.sameFiles(files,f.x.dir);
        }finally{Arrays.fill(original,(byte)0);}
    }}
    @Test public void recomputedOuterChecksumDoesNotAdmitChangedOriginalEncryptedRecord()throws Exception {try(var f=new Fixture()){
        byte[] changed=f.bytes();changed[changed.length-40]^=1;var digest=java.security.MessageDigest.getInstance("SHA-256");digest.update(changed,0,changed.length-32);byte[] sum=digest.digest();
        System.arraycopy(sum,0,changed,changed.length-32,32);Arrays.fill(sum,(byte)0);var files=NativePrivateCustodyOwnerTest.files(f.x.f.dir);
        denied(()->f.inspect(changed));NativePrivateCustodyOwnerTest.sameFiles(files,f.x.f.dir);Arrays.fill(changed,(byte)0);
    }}
    @Test public void changedOrMissingOriginalKeyInvalidatesPreviouslyVerifiedBytesWithoutReplacingFiles()throws Exception {for(int key:new int[]{0,2})try(var f=new Fixture()){
        byte[] bytes=f.bytes();try(var observed=f.inspect(bytes)){var files=NativePrivateCustodyOwnerTest.files(f.x.f.dir);
            NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},key);denied(observed::projection);denied(()->f.inspect(bytes));NativePrivateCustodyOwnerTest.sameFiles(files,f.x.f.dir);
        }finally{Arrays.fill(bytes,(byte)0);}
    }}
    @Test public void currentOriginalNamespaceMutationRefusesOldBytesAndPreservesOperation()throws Exception {try(var f=new Fixture()){
        byte[] bytes=f.bytes();try(var observed=f.inspect(bytes)){var files=NativePrivateCustodyOwnerTest.files(f.x.dir);
            f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("returned-frame-new-reference","synthetic");
            denied(observed::projection);denied(()->f.inspect(bytes));NativePrivateCustodyOwnerTest.sameFiles(files,f.x.dir);
        }finally{Arrays.fill(bytes,(byte)0);}
    }}
    @Test public void ownedBufferTamperingAndClosedBorrowedPlanRefuseWithoutDroppingOriginals()throws Exception {try(var f=new Fixture()){
        byte[] bytes=f.bytes();try(var observed=f.inspect(bytes)){var files=NativePrivateCustodyOwnerTest.files(f.x.dir);byte[] owned=(byte[])NativePrivateCustodyExchangeTest.field(observed,"returned");
            owned[0]^=1;denied(observed::projection);NativePrivateCustodyOwnerTest.sameFiles(files,f.x.dir);
        }finally{Arrays.fill(bytes,(byte)0);}
    }try(var f=new Fixture()){
        byte[] bytes=f.bytes();try(var observed=f.inspect(bytes)){f.plan.close();denied(observed::projection);denied(()->f.inspect(bytes));}
        finally{Arrays.fill(bytes,(byte)0);}
    }}
    @Test public void foreignEngineAndMissingPlanNeverBorrowOriginalOwnerAuthority()throws Exception {try(var f=new Fixture()){
        byte[] bytes=f.bytes();denied(()->f.engine.inspectUntrustedReturnedOriginalPrivateCustodyFrame(null,bytes));
        var foreign=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();
        try{denied(()->foreign.f.engine().inspectUntrustedReturnedOriginalPrivateCustodyFrame(f.plan,bytes));}
        finally{foreign.f.x.f.preserved();Arrays.fill(bytes,(byte)0);}
    }}
    @Test public void mutationsDuringExistingKeyVerificationAreRefusedNotRecaptured()throws Exception {try(var f=new Fixture()){
        byte[] bytes=f.bytes();var files=NativePrivateCustodyOwnerTest.files(f.x.dir);
        NativePrivateCustodyOwnerTest.testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},1,(Runnable)()->f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("mid-returned-crypto-change","synthetic"));
        denied(()->f.inspect(bytes));NativePrivateCustodyOwnerTest.sameFiles(files,f.x.dir);Arrays.fill(bytes,(byte)0);
    }}
}
