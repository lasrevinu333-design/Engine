package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
/** NEW12 coupled write/query/purpose/request/UNKNOWN source cases. All owners,
 * credentials and clocks are synthetic. Real host file effects are not Android,
 * server custody, HTTP, SQL or physical proof. Reflection is own TEST data only. */
public final class NativePrivateCustodyExchangeTest {
    // Refusal utility only: reflection invokes the actual presence leaf, never
    // a private constructor, positive custody owner, key or authority.
    private static boolean exchangePresence(Path path)throws Exception {
        var method=VaultEngine.NativePrivateCustodyExchangeJournal.class.getDeclaredMethod("exists",Path.class);
        method.setAccessible(true);
        try{return (Boolean)method.invoke(null,path);}
        catch(java.lang.reflect.InvocationTargetException failed){
            if(failed.getCause() instanceof Exception failure)throw failure;
            if(failed.getCause() instanceof Error failure)throw failure;
            throw new AssertionError("presence utility invocation failed");
        }
    }
    private static Path presenceFixture()throws Exception {
        String parent=System.getProperty("custodial.custody.fixture.root");
        if(parent==null)throw new AssertionError("owned fixture root required");
        return Files.createTempDirectory(Path.of(parent),"exchange-presence-",
            java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rwx------")));
    }
    @Test public void PRESENCE_missingAndNofollowObjectsKeepPresenceSemantics()throws Exception {
        Path root=presenceFixture(),missing=root.resolve("missing"),file=root.resolve("regular"),directory=root.resolve("directory"),link=root.resolve("dangling");
        Files.createFile(file);Files.createDirectory(directory);Files.createSymbolicLink(link,Path.of("missing-target"));
        assertFalse(exchangePresence(missing));assertFalse(Files.exists(missing,java.nio.file.LinkOption.NOFOLLOW_LINKS));
        for(Path present:new Path[]{file,directory,link}){
            assertTrue(Files.exists(present,java.nio.file.LinkOption.NOFOLLOW_LINKS));assertTrue(exchangePresence(present));
        }
        assertTrue(Files.isSymbolicLink(link));assertFalse(Files.exists(link));
    }
    @Test public void PRESENCE_notDirectoryIsUnknownNotAbsent()throws Exception {
        Path root=presenceFixture(),blocker=root.resolve("regular-parent");Files.createFile(blocker);
        assertTrue(Files.isRegularFile(blocker,java.nio.file.LinkOption.NOFOLLOW_LINKS));Path unreachable=blocker.resolve("original.pending");
        // Establish the intended real host IO failure before invoking the leaf:
        // no authority/plan guard or missing dependency can substitute for it.
        var actual=assertThrows(java.io.IOException.class,()->Files.readAttributes(unreachable,
            java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS));
        assertFalse(actual instanceof java.nio.file.NoSuchFileException);
        assertFalse("old Files.exists collapses this UNKNOWN to false",Files.exists(unreachable,java.nio.file.LinkOption.NOFOLLOW_LINKS));
        var propagated=assertThrows(java.io.IOException.class,()->exchangePresence(unreachable));
        assertEquals(actual.getClass(),propagated.getClass());
        if(actual instanceof java.nio.file.FileSystemException a&&propagated instanceof java.nio.file.FileSystemException b)
            assertEquals(a.getReason(),b.getReason());
        assertTrue(exchangePresence(blocker));
    }
    // CAPSULE UTILITY ONLY: no owner, capsule, key or positive capability is
    // created. These cases invoke only this adapter's actual presence leaf.
    private static boolean capsulePresence(Path path)throws Exception {
        var method=NativePrivateCapsuleFileStore.class.getDeclaredMethod("exists",Path.class);
        method.setAccessible(true);
        try{return (Boolean)method.invoke(null,path);}
        catch(java.lang.reflect.InvocationTargetException failed){
            if(failed.getCause() instanceof Exception failure)throw failure;
            if(failed.getCause() instanceof Error failure)throw failure;
            throw new AssertionError("capsule presence utility invocation failed");
        }
    }
    @Test public void CAPSULE_PRESENCE_missingAndNofollowObjectsKeepPresenceSemantics()throws Exception {
        Path root=presenceFixture(),missing=root.resolve("missing"),file=root.resolve("regular"),
            directory=root.resolve("directory"),link=root.resolve("dangling");
        Files.createFile(file);Files.createDirectory(directory);Files.createSymbolicLink(link,Path.of("missing-target"));
        assertThrows(java.nio.file.NoSuchFileException.class,()->Files.readAttributes(missing,
            java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS));
        assertFalse(capsulePresence(missing));
        for(Path present:new Path[]{file,directory,link}){
            assertNotNull(Files.readAttributes(present,java.nio.file.attribute.BasicFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS));
            assertTrue(capsulePresence(present));
        }
        assertTrue(Files.isSymbolicLink(link));assertFalse(Files.exists(link));
    }
    @Test public void CAPSULE_PRESENCE_notDirectoryIsUnknownNotAbsent()throws Exception {
        Path root=presenceFixture(),blocker=root.resolve("regular-parent");Files.createFile(blocker);
        var before=Files.readAttributes(blocker,java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertTrue(before.isRegularFile());assertNotNull(before.fileKey());
        Path unreachable=blocker.resolve("capsule.pending");
        // Real host UNKNOWN prerequisite comes BEFORE the actual Capsule
        // leaf; no earlier owning guard may stand in for this IOException.
        var actual=assertThrows(java.io.IOException.class,()->Files.readAttributes(unreachable,
            java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS));
        assertFalse(actual instanceof java.nio.file.NoSuchFileException);
        assertFalse("old Files.exists collapses UNKNOWN to false",Files.exists(unreachable,java.nio.file.LinkOption.NOFOLLOW_LINKS));
        var propagated=assertThrows(java.io.IOException.class,()->capsulePresence(unreachable));
        assertEquals(actual.getClass(),propagated.getClass());
        if(actual instanceof java.nio.file.FileSystemException a&&propagated instanceof java.nio.file.FileSystemException b)
            assertEquals(a.getReason(),b.getReason());
        assertTrue(capsulePresence(blocker));
        var after=Files.readAttributes(blocker,java.nio.file.attribute.BasicFileAttributes.class,
            java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());
        assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
    }
    private static final String ENVELOPE_TIME="2000-02-29T12:34:56.007Z",HTTP_SHA="a".repeat(64),UNKNOWN_SHA="b".repeat(64);
    // Explicit source-shape sample only. No real key/proof/clock/signature is
    // generated or qualified. Main's actual original provenance is separate.
    private static byte[] currentQuerySample()throws Exception{
        JSONObject p=new JSONObject().put("schema","custodial.original-native-private-custody-query.v1");
        for(String k:new String[]{"operation_id","original_generation_id","write_id","attempt_id","read_query_id","target_native_request_id"})
            p.put(k,"77000000-0000-4000-8000-000000000001");
        for(String k:new String[]{"principal_digest","original_frozen_work_sha256","frame_sha256","record_sha256","plan_sha256","chunk_sha256",
            "purpose_binding_sha256","purpose_attestation","target_request_body_sha256","target_attestation_digest","target_prepared_record_sha256","target_unknown_record_sha256"})p.put(k,"c".repeat(64));
        p.put("engine_revision","1").put("frame_bytes","64").put("chunk_count","1").put("chunk_index","0").put("offset","0").put("chunk_bytes","64")
            .put("owner_proof_base64","e30=").put("original_signed_wire_base64","e30=");
        return (" \n"+p.toString()+"\t ").getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
    private static void envelopeRejected(byte[] body,String time,String http,String unknown)throws Exception{
        byte[] before=body==null?null:body.clone();
        try{NativePrivateCustodyCurrentQueryEnvelope.encode(body,time,http,unknown);fail("invalid envelope input accepted");}
        catch(VaultFailure failure){assertEquals("custodial_native_private_custody_current_query_invalid",failure.code);}
        if(before!=null)assertArrayEquals(before,body);
    }
    @Test public void currentQueryEnvelopePreservesExactOriginalAndHistoricalHeaders()throws Exception{
        byte[] original=currentQuerySample(),before=original.clone();
        byte[] encoded=NativePrivateCustodyCurrentQueryEnvelope.encode(original,ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
        JSONObject p=ProviderWireJson.object(encoded,526336);
        assertEquals(java.util.Set.of("schema","original_query_body_base64","original_query_timestamp","original_query_http_attestation","original_query_unknown_record_sha256"),p.keySet());
        assertEquals("custodial.original-private-custody-current-query.v1",p.getString("schema"));
        for(String k:p.keySet())assertTrue(p.get(k) instanceof String);
        assertArrayEquals(original,java.util.Base64.getDecoder().decode(p.getString("original_query_body_base64")));
        assertEquals(ENVELOPE_TIME,p.getString("original_query_timestamp"));assertEquals(HTTP_SHA,p.getString("original_query_http_attestation"));assertEquals(UNKNOWN_SHA,p.getString("original_query_unknown_record_sha256"));
        assertArrayEquals(before,original);assertArrayEquals(encoded,NativePrivateCustodyCurrentQueryEnvelope.encode(original,ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA));
        // Output owns its bytes; mutating a returned envelope cannot affect a
        // second encoding or alter/wipe the caller's original QUERY.
        encoded[0]^=1;assertArrayEquals(before,original);
    }
    @Test public void currentQueryEnvelopeRefusesWrongPurposeAndUnclosedOrNonStringBodies()throws Exception{
        JSONObject p=ProviderWireJson.object(currentQuerySample(),393216);
        for(String schema:new String[]{"custodial.original-native-private-custody-write.v1","QUERY.v1",""})
            envelopeRejected(new JSONObject(p.toString()).put("schema",schema).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
        for(Object value:new Object[]{JSONObject.NULL,1,true,new JSONObject(),new org.json.JSONArray()})
            envelopeRejected(new JSONObject(p.toString()).put("engine_revision",value).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
        JSONObject missing=new JSONObject(p.toString());missing.remove("target_unknown_record_sha256");envelopeRejected(missing.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
        envelopeRejected(new JSONObject(p.toString()).put("chunk_base64","e30=").toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
        envelopeRejected(new JSONObject(p.toString()).put("read_query_id","").toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
    }
    @Test public void currentQueryEnvelopeStrictOriginalJsonRejectsAmbiguityAndMalformedUtf8()throws Exception{
        String text=new String(currentQuerySample(),java.nio.charset.StandardCharsets.UTF_8);
        for(String raw:new String[]{text.replaceFirst("\\{","{\"schema\":\"custodial.original-native-private-custody-query.v1\","),
            text.replaceFirst("\\{","{\"\\\\u0073chema\":\"custodial.original-native-private-custody-query.v1\","),text+"{}","[]","true","\ufeff"+text,
            text.replace("\"engine_revision\":\"1\"","\"engine_revision\":1.0"),text.replace("\"engine_revision\":\"1\"","\"engine_revision\":1e0"),
            text.replace("\"owner_proof_base64\":\"e30=\"","\"owner_proof_base64\":\"\\ud800\"")})
            envelopeRejected(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8),ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
        envelopeRejected(new byte[]{'{','"','a','"',':','"',(byte)0xff,'"','}'},ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
    }
    @Test public void currentQueryEnvelopeRejectsNullAndNonCanonicalHistoricalHeaderInputs()throws Exception{
        byte[] body=currentQuerySample();envelopeRejected(null,ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);envelopeRejected(new byte[0],ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
        for(String time:new String[]{null,"",ENVELOPE_TIME+" ","2000-02-29T12:34:56Z","2000-02-29T12:34:56.007+00:00","2001-02-29T12:34:56.007Z","0000-01-01T00:00:00.000Z","2000-02-29T24:34:56.007Z","2000-02-29T12:34:56.000007Z"})envelopeRejected(body,time,HTTP_SHA,UNKNOWN_SHA);
        for(String hash:new String[]{null,"","A".repeat(64),"g".repeat(64),"a".repeat(63),"a".repeat(65),"a".repeat(63)+"\n"}){
            envelopeRejected(body,ENVELOPE_TIME,hash,UNKNOWN_SHA);envelopeRejected(body,ENVELOPE_TIME,HTTP_SHA,hash);
        }
    }
    @Test public void currentQueryEnvelopePreservesEscapedStringBytesAndBoundsMaximumOriginal()throws Exception{
        JSONObject p=ProviderWireJson.object(currentQuerySample(),393216);
        // Structural encoding only; this sample does NOT qualify the contents
        // of proof/base64 fields. Real original purpose/HMAC validation is Main.
        p.put("owner_proof_base64","synthetic \"quoted\" \\ slash /\nEspañol 🐘");
        byte[] original=p.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        JSONObject outer=ProviderWireJson.object(NativePrivateCustodyCurrentQueryEnvelope.encode(original,ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA),526336);
        assertArrayEquals(original,java.util.Base64.getDecoder().decode(outer.getString("original_query_body_base64")));
        byte[] largest=Arrays.copyOf(currentQuerySample(),393216);Arrays.fill(largest,currentQuerySample().length,largest.length,(byte)' ');
        byte[] encoded=NativePrivateCustodyCurrentQueryEnvelope.encode(largest,ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
        assertTrue(encoded.length<=526336);assertArrayEquals(largest,java.util.Base64.getDecoder().decode(ProviderWireJson.object(encoded,526336).getString("original_query_body_base64")));
        envelopeRejected(Arrays.copyOf(largest,393217),ENVELOPE_TIME,HTTP_SHA,UNKNOWN_SHA);
    }
    public static void main(String[] selectors)throws Exception{
        if(selectors.length==1&&selectors[0].equals("--controlled-resume-withdrawal-only")){
            identityMemberResult(NativePrivateCustodyExchangeTest.class,"CONTROLLED_RESUME_sourceWithdrawalPreventsReservationAndAliasUnlink");return;
        }
        if(selectors.length==1&&selectors[0].equals("--controlled-resume-owning-only")){
            identityMemberResult(NativePrivateCustodyExchangeTest.class,"CONTROLLED_RESUME_actualPendingKeepsOriginalAndSettlesScope");
            identityMemberResult(NativePrivateCustodyExchangeTest.class,"CONTROLLED_RESUME_sourceWithdrawalPreventsReservationAndAliasUnlink");return;
        }
        if(selectors.length==2&&selectors[0].equals("--pending-exchange-publication-only")){
            if(!java.util.Set.of("PENDING_PUBLICATION_originalWriteAndUnknownKeepInodesAndWitnesses",
                "PENDING_PUBLICATION_unknownCommittedTargetRefusesWithoutReplacement").contains(selectors[1]))
                throw new IllegalArgumentException("new pending exchange publication member required");
            identityMemberResult(NativePrivateCustodyExchangeTest.class,selectors[1]);
            System.out.println("HOST_PENDING_PUBLICATION_ONLY_NOT_ANDROID_RESEND_CUSTODY_ACK_OR_POWER_LOSS");return;
        }
        if(selectors.length==1&&selectors[0].equals("--host-bound-durable-first-original-only")){
            identityMemberResult(NativePrivateCustodyExchangeTest.class,"HOST_MODEL_boundDurableFirstOriginalRetainsExactIdentity");
            System.out.println("HOST_MODEL_DURABLE_FIRST_ORIGINAL_ONLY_NOT_ANDROID_FSYNC_PRIVATE_ACK_OR_FINALIZATION");return;
        }
        if(selectors.length==2&&selectors[0].equals("--inventory-decision-journal-only")){
            if(!"DECISION_JOURNAL_fixedOriginalSlotReopensWithoutReplacement".equals(selectors[1]))
                throw new IllegalArgumentException("new decision DATA journal member required");
            identityMemberResult(NativePrivateCustodyExchangeTest.class,selectors[1]);
            System.out.println("HOST_ENCRYPTED_JOURNAL_ONLY_SYNTHETIC_DATA_NOT_CURRENT_MANAGER_BROWSER_ACK_OR_FINALIZER");return;
        }
        if(selectors.length==2&&selectors[0].equals("--capsule-presence-only")){
            if(!java.util.Set.of("CAPSULE_PRESENCE_missingAndNofollowObjectsKeepPresenceSemantics",
                "CAPSULE_PRESENCE_notDirectoryIsUnknownNotAbsent").contains(selectors[1]))
                throw new IllegalArgumentException("new Capsule presence utility member required");
            identityMemberResult(NativePrivateCustodyExchangeTest.class,selectors[1]);
            System.out.println("CAPSULE_PRESENCE_UTILITY_ONLY "+selectors[1]);return;
        }
        if(selectors.length==2&&selectors[0].equals("--exchange-presence-only")){
            if(!java.util.Set.of("PRESENCE_missingAndNofollowObjectsKeepPresenceSemantics",
                "PRESENCE_notDirectoryIsUnknownNotAbsent").contains(selectors[1]))throw new IllegalArgumentException("new presence utility member required");
            identityMemberResult(NativePrivateCustodyExchangeTest.class,selectors[1]);return;
        }
        if(selectors.length==2&&selectors[0].equals("--saved-piece-local-recovery-only")){
            if(!java.util.Set.of("LOCAL_RECOVERY_pendingAndAliasesKeepExactOriginalWitnesses",
                "LOCAL_RECOVERY_committedUnknownAndObservationsRemainUnchanged",
                "LOCAL_RECOVERY_absentJournalStaysAbsent",
                "LOCAL_RECOVERY_canceledBeforeActionPreservesPending",
                "LOCAL_RECOVERY_foreignPendingRefusesPreservingOriginal",
                "LOCAL_RECOVERY_distinctInodeAliasRefusesWithoutCleanup").contains(selectors[1]))throw new IllegalArgumentException("new local recovery member required");
            identityMemberResult(NativePrivateCustodyExchangeTest.class,selectors[1]);return;
        }
        if(selectors.length==2&&selectors[0].equals("--exchange-identity-workflow-only")){
            if(!java.util.Set.of("capturedPreparedWriteRefusesSameBytesReplacementInode",
                "IDENTITY_NEW_queryTargetWriteRejectsSameByteNewInode",
                "IDENTITY_NEW_queryTargetUnknownRejectsSameByteNewInode",
                "IDENTITY_NEW_heldOriginalSurvivesAnotherChunkAppend").contains(selectors[1]))throw new IllegalArgumentException("new identity member required");
            identityMemberResult(NativePrivateCustodyExchangeTest.class,selectors[1]);return;
        }
        if(selectors.length==1&&selectors[0].equals("--captured-exchange-file-identity-only")){
            new NativePrivateCustodyExchangeTest().capturedPreparedWriteRefusesSameBytesReplacementInode();
            System.out.println("PASS_SOURCE_HOST_CAPTURED_EXCHANGE_FILE_IDENTITY");return;
        }
        if(selectors.length==1&&selectors[0].startsWith("--exchange-")){runExchangeRecoverySelectors(selectors);return;}
        java.util.Set<String> allowed=java.util.Set.of("currentQueryEnvelopePreservesExactOriginalAndHistoricalHeaders","currentQueryEnvelopeRefusesWrongPurposeAndUnclosedOrNonStringBodies",
            "currentQueryEnvelopeStrictOriginalJsonRejectsAmbiguityAndMalformedUtf8","currentQueryEnvelopeRejectsNullAndNonCanonicalHistoricalHeaderInputs","currentQueryEnvelopePreservesEscapedStringBytesAndBoundsMaximumOriginal");
        if(selectors.length==0)throw new IllegalArgumentException("new envelope selector required");
        for(String name:selectors){if(!allowed.contains(name))throw new IllegalArgumentException("old/unknown selector refused");
            org.junit.runner.Result result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyExchangeTest.class,name));
            System.out.println("QUERY_ENVELOPE_CASE "+name+" tests="+result.getRunCount()+" failures="+result.getFailureCount());
            if(!result.wasSuccessful()){for(var failure:result.getFailures())failure.getException().printStackTrace(System.err);System.exit(1);}
        }
    }
    // NEW owning recovery selectors only. Force fault cases require the
    // narrowly targeted external syscall injection; no product I/O hook exists.
    private static void runExchangeRecoverySelectors(String[] args)throws Exception {
        if(args.length!=1)throw new AssertionError("selector required");var test=new NativePrivateCustodyExchangeTest();
        switch(args[0]) {
            case "--exchange-pending-force-only":test.recoveredPendingKeepsExactPreparedWitnessAndInode();System.out.println("PASS recoveredPendingKeepsExactPreparedWitnessAndInode");return;
            case "--exchange-alias-force-only":test.recoveredAliasKeepsExactPreparedWitnessAndOriginalInode();System.out.println("PASS recoveredAliasKeepsExactPreparedWitnessAndOriginalInode");return;
            case "--exchange-recovery-force-only":
                test.recoveredPendingKeepsExactPreparedWitnessAndInode();System.out.println("PASS recoveredPendingKeepsExactPreparedWitnessAndInode");
                test.recoveredAliasKeepsExactPreparedWitnessAndOriginalInode();System.out.println("PASS recoveredAliasKeepsExactPreparedWitnessAndOriginalInode");return;
            case "--exchange-pending-force-failure-only":test.originalForceFailureKeepsPendingPreparedExchange();System.out.println("PASS originalForceFailureKeepsPendingPreparedExchange");return;
            case "--exchange-alias-force-failure-only":test.originalForceFailureKeepsSameInodeAlias();System.out.println("PASS originalForceFailureKeepsSameInodeAlias");return;
            case "--exchange-prelink-directory-force-failure-only":test.prelinkDirectoryForceFailureKeepsPendingPreparedExchange();System.out.println("PASS prelinkDirectoryForceFailureKeepsPendingPreparedExchange");return;
            case "--exchange-postlink-directory-force-failure-only":test.postlinkDirectoryForceFailureKeepsExactAliasRecoverable();System.out.println("PASS postlinkDirectoryForceFailureKeepsExactAliasRecoverable");return;
            case "--exchange-initial-write-force-failure-only":test.initialWriteForceFailureRecoversSameCachedPreparedWitness();System.out.println("PASS initialWriteForceFailureRecoversSameCachedPreparedWitness");return;
            default:throw new AssertionError("NEW selector required");
        }
    }
    private static void samePreparedWitness(JSONObject original,JSONObject current,VaultEngine.NativePrivateCustodyPreparedExchange prepared,
        byte[] expectedBody,Map<String,String> expectedHeaders)throws Exception {
        noAuthority(current);assertEquals(original.toString(),current.toString());byte[] actual=body(prepared);
        try{assertArrayEquals(expectedBody,actual);}finally{Arrays.fill(actual,(byte)0);}
        assertEquals(expectedHeaders,field(prepared,"headers"));
    }
    @SuppressWarnings("unchecked") private static Map<String,String> headers(VaultEngine.NativePrivateCustodyPreparedExchange prepared)throws Exception {
        return new java.util.HashMap<>((Map<String,String>)field(prepared,"headers"));
    }
    @Test public void recoveredPendingKeepsExactPreparedWitnessAndInode()throws Exception {recoveryWithoutReplacement(false);}
    @Test public void recoveredAliasKeepsExactPreparedWitnessAndOriginalInode()throws Exception {recoveryWithoutReplacement(true);}
    private static void recoveryWithoutReplacement(boolean alias)throws Exception {try(var f=new Fixture()){
        Path committed=f.dir.resolve("write-0.bin"),pending=f.dir.resolve("write-0.pending");JSONObject original;byte[] expectedBody;Map<String,String> expectedHeaders;
        try(var prepared=f.write(0)){original=prepared.projection();expectedBody=body(prepared);expectedHeaders=headers(prepared);}
        byte[] encrypted=Files.readAllBytes(committed);Object inode=Files.readAttributes(committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
        if(alias)Files.createLink(pending,committed);else Files.move(committed,pending);f.clock.now+=1200;
        try(var recovered=f.write(0)){
            noAuthority(recovered.projection());assertFalse(recovered.projection().getBoolean("original_request_record_locally_committed_observed"));
            f.engine.resumeOriginalPrivateCustodyPreparedExchange(recovered);samePreparedWitness(original,recovered.projection(),recovered,expectedBody,expectedHeaders);
        }
        assertFalse(Files.exists(pending));assertArrayEquals(encrypted,Files.readAllBytes(committed));
        assertEquals(inode,Files.readAttributes(committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
        assertFalse(Files.exists(f.dir.resolve("write_unknown-0.bin")));assertFalse(Files.exists(f.dir.resolve("query-0.bin")));
        assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));Arrays.fill(encrypted,(byte)0);Arrays.fill(expectedBody,(byte)0);expectedHeaders.clear();
    }}
    public void originalForceFailureKeepsPendingPreparedExchange()throws Exception {recoveryForceFailure(false,false);}
    public void originalForceFailureKeepsSameInodeAlias()throws Exception {recoveryForceFailure(true,false);}
    public void prelinkDirectoryForceFailureKeepsPendingPreparedExchange()throws Exception {recoveryForceFailure(false,false);}
    public void postlinkDirectoryForceFailureKeepsExactAliasRecoverable()throws Exception {recoveryForceFailure(false,true);}
    public void initialWriteForceFailureRecoversSameCachedPreparedWitness()throws Exception {try(var f=new Fixture()){
        if(!Boolean.getBoolean("custodial.exchange.force.injected"))throw new AssertionError("external targeted force injection required");
        denied(()->{try(var ignored=f.write(0)){}});
        Path pending=f.dir.resolve("write-0.pending"),committed=f.dir.resolve("write-0.bin");assertTrue(Files.exists(pending));assertFalse(Files.exists(committed));
        byte[] encrypted=Files.readAllBytes(pending);Object inode=Files.readAttributes(pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
        var saved=NativePrivateCustodyOwnerTest.files(f.dir);f.clock.now+=1200;
        try(var recovered=f.write(0)){
            JSONObject expected=recovered.projection();noAuthority(expected);assertEquals("PENDING",expected.get("journal_phase"));
            assertFalse(expected.getBoolean("original_request_record_locally_committed_observed"));NativePrivateCustodyOwnerTest.sameFiles(saved,f.dir);
            byte[] expectedBody=body(recovered);Map<String,String> expectedHeaders=headers(recovered);
            try{expected.put("journal_phase","COMMITTED").put("original_request_record_locally_committed_observed",true);
                f.engine.resumeOriginalPrivateCustodyPreparedExchange(recovered);samePreparedWitness(expected,recovered.projection(),recovered,expectedBody,expectedHeaders);
            }finally{Arrays.fill(expectedBody,(byte)0);expectedHeaders.clear();}
        }
        assertFalse(Files.exists(pending));assertArrayEquals(encrypted,Files.readAllBytes(committed));
        assertEquals(inode,Files.readAttributes(committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
        assertFalse(Files.exists(f.dir.resolve("write_unknown-0.bin")));assertFalse(Files.exists(f.dir.resolve("query-0.bin")));
        assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));Arrays.fill(encrypted,(byte)0);
    }}
    private static void recoveryForceFailure(boolean alias,boolean postLink)throws Exception {try(var f=new Fixture()){
        if(!Boolean.getBoolean("custodial.exchange.force.injected"))throw new AssertionError("external targeted force injection required");
        Path committed=f.dir.resolve("write-0.bin"),pending=f.dir.resolve("write-0.pending");JSONObject original;byte[] expectedBody;Map<String,String> expectedHeaders;
        try(var prepared=f.write(0)){original=prepared.projection();expectedBody=body(prepared);expectedHeaders=headers(prepared);}
        byte[] encrypted=Files.readAllBytes(committed);Object inode=Files.readAttributes(committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
        if(alias)Files.createLink(pending,committed);else Files.move(committed,pending);var before=NativePrivateCustodyOwnerTest.files(f.dir);f.clock.now+=1200;
        try(var recovered=f.write(0)){denied(()->f.engine.resumeOriginalPrivateCustodyPreparedExchange(recovered));}
        if(!postLink)NativePrivateCustodyOwnerTest.sameFiles(before,f.dir);
        assertTrue(Files.exists(pending));assertEquals(alias||postLink,Files.exists(committed));assertArrayEquals(encrypted,Files.readAllBytes(pending));
        assertEquals(inode,Files.readAttributes(pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
        if(alias||postLink){assertTrue(Files.isSameFile(committed,pending));assertArrayEquals(encrypted,Files.readAllBytes(committed));}
        try(var recovered=f.write(0)){f.engine.resumeOriginalPrivateCustodyPreparedExchange(recovered);
            samePreparedWitness(original,recovered.projection(),recovered,expectedBody,expectedHeaders);}
        assertFalse(Files.exists(pending));assertArrayEquals(encrypted,Files.readAllBytes(committed));
        assertFalse(Files.exists(f.dir.resolve("write_unknown-0.bin")));assertFalse(Files.exists(f.dir.resolve("query-0.bin")));
        assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));Arrays.fill(encrypted,(byte)0);Arrays.fill(expectedBody,(byte)0);expectedHeaders.clear();
    }}
    @Test public void capturedPreparedWriteRefusesSameBytesReplacementInode()throws Exception {
        try(var original=new NativePrivateCustodyOperationTest.Fixture(true);
            var operation=original.prepare();
            var plan=original.f.engine().prepareOriginalPrivateCustodyChunkIdentityPlan(operation)){
            var journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(original.f.root.toFile());
            try(var prepared=original.f.engine().prepareOriginalPrivateCustodyWrite(plan,journal,0)){
                Path file=original.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY).resolve("write-0.bin");
                byte[] bytes=Files.readAllBytes(file);
                try{
                    Object before=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
                    Path preserved=original.f.root.resolve("synthetic-preserved-exchange-inode"),replacement=original.f.root.resolve("synthetic-exchange-replacement");
                    Files.createLink(preserved,file);Files.copy(file,replacement);
                    Files.setPosixFilePermissions(replacement,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                    Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    assertArrayEquals(bytes,Files.readAllBytes(file));
                    assertNotEquals(before,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                    assertThrows(VaultFailure.class,prepared::projection);
                    assertArrayEquals(bytes,Files.readAllBytes(preserved));
                }finally{java.util.Arrays.fill(bytes,(byte)0);}
            }
        }
    }
    // NEW members never use the legacy unguarded Fixture. This is the actual
    static void identityMemberResult(Class<?> owner,String name)throws Exception {
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(owner,name));
        System.out.println("IDENTITY_SOURCE_CASE "+name+" tests="+result.getRunCount()+" failures="+result.getFailureCount());
        if(result.getRunCount()!=1||!result.wasSuccessful()){
            for(var failed:result.getFailures()){
                Throwable error=failed.getException();System.err.println("IDENTITY_SOURCE_FAILURE_CLASS "+error.getClass().getName());
                if(error instanceof VaultFailure&&((VaultFailure)error).code.matches("[A-Za-z0-9_]{1,96}"))System.err.println("IDENTITY_SOURCE_FAILURE_CODE "+((VaultFailure)error).code);
                for(var point:error.getStackTrace())System.err.println("IDENTITY_SOURCE_FAILURE_AT "+point.getClassName()+"#"+point.getMethodName()+":"+point.getLineNumber());
            }
            throw new AssertionError("new_identity_source_member_failed");
        }
    }
    // The actual
    // existing owning eight-reader/operation fixture, not a durability flag.
    static final class GuardedIdentityFixture implements AutoCloseable {
        final NativePrivateCustodyOperationTest.Fixture x;
        final VaultEngine engine;final VaultEngine.NativePrivateCustodyOperationObservation operation;
        final VaultEngine.NativePrivateCustodyChunkIdentityPlan plan;
        final VaultEngine.NativePrivateCustodyExchangeJournal journal;final Path dir;final MutableClock clock;
        GuardedIdentityFixture()throws Exception {
            if(System.getProperty("custodial.custody.fixture.root")==null
                ||!Boolean.getBoolean("custodial.fixture.original-batch-before-capture"))
                throw new AssertionError("existing owned root and original batch prerequisite required");
            x=new NativePrivateCustodyOperationTest.Fixture(true);
            VaultEngine.NativePrivateCustodyOperationObservation acquired=null;
            VaultEngine.NativePrivateCustodyChunkIdentityPlan planned=null;
            try{engine=x.f.engine();acquired=x.prepare();operation=acquired;
                planned=engine.prepareOriginalPrivateCustodyChunkIdentityPlan(operation);plan=planned;
                journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(x.f.root.toFile());
                dir=x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);
                clock=x.f.x.f.x.f.batch.old.clock;
            }catch(Exception|Error failure){if(planned!=null)planned.close();if(acquired!=null)acquired.close();x.close();throw failure;}
        }
        /** Additive normal capture of the SAME supplied initial UNIT owner. */
        GuardedIdentityFixture(NativePrivateCustodyOwnerTest.Fixture original)throws Exception {
            if(System.getProperty("custodial.custody.fixture.root")==null
                ||!Boolean.getBoolean("custodial.fixture.original-batch-before-capture"))
                throw new AssertionError("existing owned root and original batch prerequisite required");
            x=new NativePrivateCustodyOperationTest.Fixture(original,true);
            VaultEngine.NativePrivateCustodyOperationObservation acquired=null;
            VaultEngine.NativePrivateCustodyChunkIdentityPlan planned=null;
            try{engine=x.f.engine();acquired=x.prepare();operation=acquired;
                planned=engine.prepareOriginalPrivateCustodyChunkIdentityPlan(operation);plan=planned;
                journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(x.f.root.toFile());
                dir=x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);
                clock=x.f.x.f.x.f.batch.old.clock;
            }catch(Exception|Error failure){if(planned!=null)planned.close();if(acquired!=null)acquired.close();x.close();throw failure;}
        }
        static GuardedIdentityFixture boundDurableFirstOriginalForHostModel()throws Exception {
            return new GuardedIdentityFixture(NativePrivateCustodyOperationTest.Fixture.boundDurableFirstOriginalForHostModel());
        }
        private GuardedIdentityFixture(NativePrivateCustodyOperationTest.Fixture original)throws Exception {
            x=original;
            VaultEngine.NativePrivateCustodyOperationObservation acquired=null;
            VaultEngine.NativePrivateCustodyChunkIdentityPlan planned=null;
            try{engine=x.f.engine();acquired=x.recover();operation=acquired;
                planned=engine.prepareOriginalPrivateCustodyChunkIdentityPlan(operation);plan=planned;
                journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(x.f.root.toFile());
                dir=x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);
                clock=x.f.x.f.x.f.batch.old.clock;
            }catch(Exception|Error failure){if(planned!=null)planned.close();if(acquired!=null)acquired.close();x.close();throw failure;}
        }
        VaultEngine.NativePrivateCustodyPreparedExchange write(int index)throws Exception{return engine.prepareOriginalPrivateCustodyWrite(plan,journal,index);}
        VaultEngine.NativePrivateCustodyPreparedExchange query(int index)throws Exception{return engine.prepareOriginalPrivateCustodyQuery(plan,journal,index);}
        @Override public void close(){plan.close();operation.close();x.close();}
    }
    /** New opt-in construction join only: actual production factories and host
     * files/JCE when run, synthetic original data. No manager/browser/ACK/HELD
     * token is supplied and no finalization or Android durability is claimed. */
    @Test public void HOST_MODEL_boundDurableFirstOriginalRetainsExactIdentity()throws Exception {
        assertNotNull(System.getProperty("custodial.custody.fixture.root"));
        assertTrue(Boolean.getBoolean("custodial.fixture.original-batch-before-capture"));
        assertEquals("original-bound-prefs-host-model",System.getProperty("custodial.fixture.semantic-join-persistence"));
        AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
        // A real saved PROCESS_ONLY operation blocks the FIRST absence factory;
        // neither its ciphertext nor original source is upgraded/re-encrypted.
        try(var legacy=new NativePrivateCustodyOperationTest.Fixture(true);var original=legacy.prepare()){
            assertEquals("PROCESS_ONLY",original.projection().getString("original_native_mutation_stamp"));
            var before=NativePrivateCustodyOperationTest.saved(legacy.dir);
            var capsule=NativePrivateCustodyOperationTest.saved(legacy.f.dir);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(legacy.f.x.f.x);
            assertThrows(VaultFailure.class,legacy.store::acquireInitialMutationBaselineAbsence);
            AndroidProtectedWorkPreferences.requireMutationEpochNotInstalled();
            NativePrivateCustodyOperationTest.same(before,legacy.dir);NativePrivateCustodyOperationTest.same(capsule,legacy.f.dir);stable.check();
        }
        try(var f=GuardedIdentityFixture.boundDurableFirstOriginalForHostModel()){
            var source=f.x.f.x.f;var census=source.x;var old=census.f.batch.old;
            var stable=new NativeRetainedNamespaceCensusTest.Stable(census);
            var raw=new java.util.TreeMap<String,Map<String,?>>();
            for(String name:census.unknown.keySet())raw.put(name,census.raw(name));
            assertEquals(8,raw.size());
            assertSame(census.unknown.get(NativeVaultProviderReferenceCensus.VAULT),source.boundVaultDisk.memory);
            assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(source.boundVaultDisk.memory,source.boundVaultPreferences.getAll()));
            assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(old.workDisk.memory,source.boundWorkPreferences.getAll()));
            assertEquals(VaultPhase.ACTIVE,source.coldOriginalVaultSnapshot().phase);
            assertEquals(0,source.boundVaultDisk.commits);
            assertThrows(VaultFailure.class,f.x.f.h.g::projection);
            assertEquals("DURABLE_ATTEMPT:0",f.x.guardedNamespaces.originalMutationStampForOwningOperation());
            var p=f.operation.projection();NativePrivateCustodyOperationTest.noAuthority(p);
            assertEquals("DURABLE_ATTEMPT:0",p.getString("original_native_mutation_stamp"));
            var operationFiles=NativePrivateCustodyOperationTest.saved(f.x.dir);
            var capsuleFiles=NativePrivateCustodyOperationTest.saved(f.x.f.dir);
            Path epoch=f.x.f.root.resolve(NativePrivateMutationEpochStore.DIRECTORY);
            var epochFiles=NativePrivateCustodyOperationTest.saved(epoch);
            var journal=NativePrivateMutationEpochStore.fromNativeNoBackupRoot(f.x.f.root.toFile());
            try(var current=journal.readCurrent()){assertEquals(0,current.counter());}
            var fresh=NativePrivateCustodyOperationStore.fromNativeNoBackupRoot(f.x.f.root.toFile());
            try(var inspected=fresh.inspectOriginal(f.x.frame);
                var recovered=f.engine.recoverOriginalPrivateCustodyOperation(f.x.frame,fresh);
                var plan=f.engine.prepareOriginalPrivateCustodyChunkIdentityPlan(recovered)){
                assertEquals("COMMITTED",inspected.metadata().getString("journal_phase"));
                assertEquals(p.toString(),recovered.projection().toString());
                assertEquals(f.plan.projection().toString(),plan.projection().toString());
                for(int i=0;i<plan.projection().getInt("chunk_count");i++)
                    assertEquals(f.plan.chunkMetadata(i).toString(),plan.chunkMetadata(i).toString());
            }
            assertThrows(VaultFailure.class,f.x.store::acquireInitialMutationBaselineAbsence);
            NativePrivateCustodyOperationTest.same(operationFiles,f.x.dir);
            NativePrivateCustodyOperationTest.same(capsuleFiles,f.x.f.dir);
            NativePrivateCustodyOperationTest.same(epochFiles,epoch);
            assertFalse(Files.exists(f.dir,java.nio.file.LinkOption.NOFOLLOW_LINKS));
            for(String name:raw.keySet())assertSame(name,raw.get(name),census.raw(name));
            assertTrue(NativeProtectedWorkSnapshot.exactRawEquals(raw.get(NativeVaultProviderReferenceCensus.VAULT),source.coldOriginalVaultValues()));
            stable.check();
        }
    }
    private static Object decisionJournalCall(Object target,String name,Class<?>[] types,Object... args)throws Exception {
        var method=target.getClass().getDeclaredMethod(name,types);method.setAccessible(true);
        try{return method.invoke(target,args);}
        catch(java.lang.reflect.InvocationTargetException failed){
            if(failed.getCause() instanceof Exception error)throw error;
            if(failed.getCause() instanceof Error error)throw error;
            throw new AssertionError(failed.getCause());
        }
    }
    @SuppressWarnings({"rawtypes","unchecked"})
    @Test public void DECISION_JOURNAL_fixedOriginalSlotReopensWithoutReplacement()throws Exception {
        // Existing real source-plan fixture; reflective journal calls below
        // write synthetic DATA only, never mint a manager/ACK/private control.
        try(var x=new GuardedIdentityFixture()){
            Class<? extends Enum> kinds=(Class<? extends Enum>)Class.forName(
                VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal$Kind");
            Object decision=Enum.valueOf(kinds,"INVENTORY_DECISION"),frame=Enum.valueOf(kinds,"INVENTORY_FRAME");
            Class<?>[] keyed={VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,kinds,int.class};
            Class<?>[] keyTypes={kinds,int.class,VaultEngine.NativePrivateCustodyChunkIdentityPlan.class};
            Class<?>[] appended={VaultEngine.NativePrivateCustodyChunkIdentityPlan.class,kinds,int.class,String.class};
            String key=(String)decisionJournalCall(x.journal,"key",keyTypes,decision,0,x.plan);
            assertEquals("inventory_decision-0",key);
            var document=new JSONObject().put("schema","custodial.native-private-custody-exchange-evidence.v1")
                .put("entry_key",key).put("plan_sha256",field(x.plan,"planSha256"))
                .put("operation_id",field(x.plan,"operationId"))
                .put("observation",new JSONObject().put("state","SYNTHETIC_DATA_ONLY_NOT_ACK")
                    .put("exact_opaque_bytes","storage-only ".repeat(1000)));
            try(var first=(AutoCloseable)decisionJournalCall(x.journal,"appendAbsent",appended,x.plan,decision,0,document.toString())){
                assertEquals("COMMITTED",field(first,"phase"));
                assertEquals(document.toString(),field(first,"document"));
                byte[] original=Files.readAllBytes(x.dir.resolve(key+".bin"));
                try{
                    var files=NativePrivateCustodyOwnerTest.files(x.dir);
                    try(var read=(AutoCloseable)decisionJournalCall(x.journal,"read",keyed,x.plan,decision,0)){
                        assertEquals("COMMITTED",field(read,"phase"));
                        assertEquals(field(first,"diskSha"),field(read,"diskSha"));
                        assertEquals(document.toString(),field(read,"document"));
                    }
                    assertThrows(VaultFailure.class,()->decisionJournalCall(x.journal,"appendAbsent",appended,x.plan,decision,0,document.toString()));
                    assertThrows(VaultFailure.class,()->decisionJournalCall(x.journal,"appendAbsent",appended,x.plan,decision,0,document.toString()+" "));
                    assertThrows(VaultFailure.class,()->decisionJournalCall(x.journal,"key",keyTypes,decision,1,x.plan));
                    var orphanFrame=new JSONObject(document.toString()).put("entry_key","inventory_frame-0");
                    assertThrows(VaultFailure.class,()->decisionJournalCall(x.journal,"appendAbsent",appended,x.plan,frame,0,orphanFrame.toString()));
                    NativePrivateCustodyOwnerTest.sameFiles(files,x.dir);
                    assertArrayEquals(original,Files.readAllBytes(x.dir.resolve(key+".bin")));
                    Path preserved=replaceIdentityOriginal(x,key+".bin","decision-data");
                    assertArrayEquals(original,Files.readAllBytes(preserved));
                    assertThrows(VaultFailure.class,()->decisionJournalCall(first,"open",new Class<?>[0]));
                    assertArrayEquals(original,Files.readAllBytes(x.dir.resolve(key+".bin")));
                }finally{Arrays.fill(original,(byte)0);}
            }
        }
    }
    /** Host fixture mutation ONLY. Retain the actual original inode outside
     * the journal; successor has identical bytes/size/mtime/private mode. */
    static Path replaceIdentityOriginal(GuardedIdentityFixture f,String filename,String label)throws Exception {
        Path file=f.dir.resolve(filename),preserved=f.x.f.root.resolve("synthetic-identity-original-"+label),
            replacement=f.x.f.root.resolve("synthetic-identity-replacement-"+label);
        var before=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertNotNull(before.fileKey());byte[] bytes=Files.readAllBytes(file);
        try{Files.createLink(preserved,file);Files.copy(file,replacement);
            Files.setPosixFilePermissions(replacement,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            Files.setLastModifiedTime(replacement,before.lastModifiedTime());
            Files.move(replacement,file,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            var after=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            assertNotEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
            assertEquals(before.fileKey(),Files.readAttributes(preserved,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
            assertArrayEquals(bytes,Files.readAllBytes(file));assertArrayEquals(bytes,Files.readAllBytes(preserved));return preserved;
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    static void wipeIdentitySnapshot(Map<String,byte[]> files){for(byte[] bytes:files.values())Arrays.fill(bytes,(byte)0);files.clear();}
    @Test public void IDENTITY_NEW_queryTargetWriteRejectsSameByteNewInode()throws Exception {queryTargetIdentity("write-0.bin","query-write");}
    @Test public void IDENTITY_NEW_queryTargetUnknownRejectsSameByteNewInode()throws Exception {queryTargetIdentity("write_unknown-0.bin","query-unknown");}
    private static void queryTargetIdentity(String filename,String label)throws Exception {
        try(var f=new GuardedIdentityFixture();var write=f.write(0)){
            f.engine.fenceOriginalPrivateCustodyExchange(write);
            try(var query=f.query(0)){
                noAuthority(query.projection());var saved=NativePrivateCustodyOwnerTest.files(f.dir);
                try{replaceIdentityOriginal(f,filename,label);var changed=NativePrivateCustodyOwnerTest.files(f.dir);
                    try{assertThrows(VaultFailure.class,query::projection);
                        assertThrows(VaultFailure.class,()->f.engine.fenceOriginalPrivateCustodyExchange(query));
                        assertFalse(Files.exists(f.dir.resolve("query_unknown-0.bin")));
                        NativePrivateCustodyOwnerTest.sameFiles(saved,f.dir);NativePrivateCustodyOwnerTest.sameFiles(changed,f.dir);
                    }finally{wipeIdentitySnapshot(changed);}
                }finally{wipeIdentitySnapshot(saved);}
            }
        }
    }
    @Test public void IDENTITY_NEW_heldOriginalSurvivesAnotherChunkAppend()throws Exception {
        try(var f=new GuardedIdentityFixture();var first=f.write(0)){
            assertTrue(f.plan.projection().getInt("chunk_count")>=2);var before=first.projection();noAuthority(before);
            Path file=f.dir.resolve("write-0.bin");var identity=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            byte[] encrypted=Files.readAllBytes(file);
            try{try(var next=f.write(1)){noAuthority(next.projection());}
                assertEquals(before.toString(),first.projection().toString());
                assertEquals(identity,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(encrypted,Files.readAllBytes(file));assertFalse(Files.exists(f.dir.resolve("write_unknown-0.bin")));
                f.engine.fenceOriginalPrivateCustodyExchange(first);try(var query=f.query(0)){noAuthority(query.projection());}
                assertEquals(identity,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(encrypted,Files.readAllBytes(file));
            }finally{Arrays.fill(encrypted,(byte)0);}
        }
    }
    // Newly affected saved-owner local recovery only. The SharedPreferences
    // seam is the existing coldSavedOwner recipe; only getAll is supported.
    // This is synthetic HOST source, not Android or manager authentication.
    private static VaultEngine.NativePrivateCustodySavedReadOwner localSavedOwner(GuardedIdentityFixture f)throws Exception {
        var source=f.x.f.x.f.x;var existing=new java.util.TreeMap<String,android.content.SharedPreferences>();
        for(String name:source.unknown.keySet())existing.put(name,(android.content.SharedPreferences)java.lang.reflect.Proxy.newProxyInstance(
            NativePrivateCustodyExchangeTest.class.getClassLoader(),new Class<?>[]{android.content.SharedPreferences.class},(proxy,method,args)->{
                if(!method.getName().equals("getAll"))throw new AssertionError("saved reader edited original source");
                return new java.util.HashMap<>(source.raw(name));
            }));
        return f.engine.prepareSavedOriginalPrivateCustodyCurrentRead(source.f.batch.old.work,source.f.batch.old.principal,null,
            source.f.provider,source.f.batch.journal,AndroidProtectedNamespaceReaders.bind(existing),f.x.f.store,f.x.store);
    }
    private static void localNoAuthority(JSONObject p,int observed,int recovered)throws Exception {
        assertEquals("custodial.native-saved-original-piece-journal-resume.v2",p.get("schema"));
        assertEquals("EXISTING_ORIGINAL_PIECE_JOURNALS_LOCALLY_RECOVERED_NO_TRANSPORT_OR_ACK",p.get("state"));
        assertEquals(observed,p.getInt("existing_records_observed"));assertEquals(recovered,p.getInt("pending_or_alias_records_recovered"));
        assertEquals(14,p.length());
        for(String flag:new String[]{"missing_records_created","network_dispatch_allowed","remote_future_acceptance_or_transaction_authority",
            "inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertEquals(Boolean.FALSE,p.get(flag));
        // These retained native-only fixtures have no browser journal. The
        // new owning result must say UNKNOWN, never invent an empty inventory.
        JSONObject browser=p.getJSONObject("browser_local_journal");assertEquals(16,browser.length());
        assertEquals("custodial.native-original-browser-local-journal-resume.v1",browser.get("schema"));
        assertEquals("NO_SAVED_BROWSER_FRAME_OBSERVED",browser.get("state"));
        assertEquals(0,browser.getInt("existing_records_observed"));assertEquals(0,browser.getInt("pending_or_alias_records_recovered"));
        assertSame(JSONObject.NULL,browser.get("declared_chunk_count"));assertSame(JSONObject.NULL,browser.get("missing_chunk_count"));
        assertEquals(Boolean.FALSE,browser.get("all_original_browser_parts_committed_observed"));
        assertEquals("",browser.get("current_local_part_set_sha256"));
        for(String flag:new String[]{"missing_records_created","network_dispatch_allowed","current_remote_browser_custody",
            "inventory_acknowledged","work_accepted","finalizer_allowed","key_removal","phone_released"})assertEquals(Boolean.FALSE,browser.get(flag));
    }
    private static final class LocalFiles implements AutoCloseable {
        final java.util.List<Path> directories;final Map<Path,byte[]> bytes=new java.util.LinkedHashMap<>();
        final Map<Path,Object> inodes=new java.util.LinkedHashMap<>();
        LocalFiles(GuardedIdentityFixture f)throws Exception {
            directories=java.util.List.of(f.x.f.dir,f.x.dir,f.dir);
            for(Path dir:directories)if(Files.exists(dir))try(var files=Files.newDirectoryStream(dir)){for(Path file:files){
                bytes.put(file,Files.readAllBytes(file));inodes.put(file,Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            }}
        }
        void unchanged()throws Exception {
            var names=new java.util.HashSet<Path>();for(Path dir:directories)if(Files.exists(dir))try(var files=Files.newDirectoryStream(dir)){for(Path file:files)names.add(file);}
            assertEquals(bytes.keySet(),names);
            for(var entry:bytes.entrySet()){
                byte[] actual=Files.readAllBytes(entry.getKey());try{assertArrayEquals(entry.getValue(),actual);}finally{Arrays.fill(actual,(byte)0);}
                assertEquals(inodes.get(entry.getKey()),Files.readAttributes(entry.getKey(),java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
            }
        }
        @Override public void close(){for(byte[] value:bytes.values())Arrays.fill(value,(byte)0);}
    }
    private static final class LocalHistory implements AutoCloseable {
        final String[] projections=new String[2];final byte[][] bodies=new byte[2][];
        final java.util.List<Map<String,String>> signedHeaders=new java.util.ArrayList<>();
        final java.util.List<NativePrivateCustodyHttpOutcomeTest.Connection> connections=new java.util.ArrayList<>();
        LocalHistory(GuardedIdentityFixture f)throws Exception {
            NativePrivateCustodyHttp http=new NativePrivateCustodyHttp(url->{
                assertEquals(NativePrivateCustodyHttp.ORIGIN+VaultEngine.NativePrivateCustodyPreparedExchange.PATH,url.toString());
                var connection=new NativePrivateCustodyHttpOutcomeTest.Connection(url);connections.add(connection);return connection;
            },f.clock);
            try{
                for(int kind=0;kind<2;kind++)try(var prepared=kind==0?f.write(0):f.query(0)){
                    var attempt=new NativeRetainedHttp.Attempt();
                    try{var result=f.engine.sendOriginalPrivateCustodyExchange(prepared,http,attempt);
                        assertTrue(result.getBoolean("http_observation_locally_committed"));assertFalse(result.getBoolean("inventory_acknowledged"));
                    }finally{attempt.cancel();}
                    projections[kind]=prepared.projection().toString();bodies[kind]=body(prepared);signedHeaders.add(headers(prepared));
                }
                assertEquals(2,connections.size());for(var connection:connections)assertEquals(1,connection.disconnects);
            }catch(Exception|Error failure){close();throw failure;}
        }
        void sameWitnesses(GuardedIdentityFixture f)throws Exception {
            for(int kind=0;kind<2;kind++)try(var prepared=kind==0?f.write(0):f.query(0)){
                samePreparedWitness(new JSONObject(projections[kind]),prepared.projection(),prepared,bodies[kind],signedHeaders.get(kind));
                assertThrows(VaultFailure.class,()->f.engine.fenceOriginalPrivateCustodyExchange(prepared));
                var historical=f.engine.observeOriginalPrivateCustodyExchangeOutcome(prepared);
                assertEquals("HISTORICAL_HTTP_RESPONSE_ONLY_NOT_CUSTODY_ACK",historical.get("state"));assertFalse(historical.getBoolean("resend_allowed"));
            }
            assertEquals(2,connections.size());for(var connection:connections)assertEquals(1,connection.disconnects);
        }
        @Override public void close(){for(byte[] bytes:bodies)if(bytes!=null)Arrays.fill(bytes,(byte)0);for(var h:signedHeaders)h.clear();}
    }
    @Test public void LOCAL_RECOVERY_pendingAndAliasesKeepExactOriginalWitnesses()throws Exception {
        for(boolean alias:new boolean[]{false,true})try(var control=new NativePrivateCustodyFrameReadControl();var f=new GuardedIdentityFixture();var history=new LocalHistory(f);
            var originals=new LocalFiles(f)){
            for(String name:new String[]{"write","write_unknown","write_observation","query","query_unknown","query_observation"}){
                Path committed=f.dir.resolve(name+"-0.bin"),pending=f.dir.resolve(name+"-0.pending");
                assertTrue(Files.exists(committed));if(alias)Files.createLink(pending,committed);else Files.move(committed,pending);
            }
            try(var owner=localSavedOwner(f)){
                localNoAuthority(f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(owner,f.journal,control),6,6);
                originals.unchanged();history.sameWitnesses(f);originals.unchanged();
                assertThrows(VaultFailure.class,()->f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(owner,f.journal,control));originals.unchanged();
            }
        }
    }
    @Test public void LOCAL_RECOVERY_committedUnknownAndObservationsRemainUnchanged()throws Exception {
        try(var control=new NativePrivateCustodyFrameReadControl();var f=new GuardedIdentityFixture();var history=new LocalHistory(f);
            var originals=new LocalFiles(f);var owner=localSavedOwner(f)){
            localNoAuthority(f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(owner,f.journal,control),6,0);
            originals.unchanged();history.sameWitnesses(f);originals.unchanged();
            assertThrows(VaultFailure.class,()->f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(owner,f.journal,control));originals.unchanged();
        }
    }
    @Test public void LOCAL_RECOVERY_absentJournalStaysAbsent()throws Exception {
        try(var control=new NativePrivateCustodyFrameReadControl();var f=new GuardedIdentityFixture();var originals=new LocalFiles(f);var owner=localSavedOwner(f)){
            assertFalse(Files.exists(f.dir));localNoAuthority(f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(owner,f.journal,control),0,0);
            assertFalse(Files.exists(f.dir));originals.unchanged();
        }
    }
    @Test public void LOCAL_RECOVERY_canceledBeforeActionPreservesPending()throws Exception {
        try(var control=new NativePrivateCustodyFrameReadControl();var f=new GuardedIdentityFixture()){
            try(var write=f.write(0)){noAuthority(write.projection());}Files.move(f.dir.resolve("write-0.bin"),f.dir.resolve("write-0.pending"));
            try(var originals=new LocalFiles(f);var owner=localSavedOwner(f)){
                control.cancel();assertThrows(VaultFailure.class,()->f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(owner,f.journal,control));
                originals.unchanged();assertFalse(Files.exists(f.dir.resolve("write-0.bin")));
            }
        }
    }
    @Test public void LOCAL_RECOVERY_foreignPendingRefusesPreservingOriginal()throws Exception {
        byte[] foreign;
        try(var other=new GuardedIdentityFixture();var write=other.write(0)){noAuthority(write.projection());foreign=Files.readAllBytes(other.dir.resolve("write-0.bin"));}
        try(var control=new NativePrivateCustodyFrameReadControl();var f=new GuardedIdentityFixture()){
            try(var write=f.write(0)){noAuthority(write.projection());}Path original=f.dir.resolve("write-0.bin"),pending=f.dir.resolve("write-0.pending");
            Path held=f.x.f.root.resolve("local-recovery-held-original"),replacement=f.x.f.root.resolve("local-recovery-foreign-replacement");
            byte[] saved=Files.readAllBytes(original);Object key=Files.readAttributes(original,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            try{Files.createLink(held,original);Files.move(original,pending);
                try(var owner=localSavedOwner(f)){
                    try(var output=java.nio.channels.FileChannel.open(replacement,java.util.Set.of(java.nio.file.StandardOpenOption.WRITE,
                        java.nio.file.StandardOpenOption.CREATE_NEW,java.nio.file.LinkOption.NOFOLLOW_LINKS),
                        java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")))){
                        var buffer=java.nio.ByteBuffer.wrap(foreign);while(buffer.hasRemaining())assertTrue(output.write(buffer)>0);
                    }
                    Files.move(replacement,pending,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    try(var originals=new LocalFiles(f)){
                        assertThrows(VaultFailure.class,()->f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(owner,f.journal,control));originals.unchanged();
                        assertArrayEquals(saved,Files.readAllBytes(held));assertEquals(key,Files.readAttributes(held,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                        assertFalse(Files.exists(original));
                    }
                }
            }finally{Arrays.fill(saved,(byte)0);}
        }finally{Arrays.fill(foreign,(byte)0);}
    }
    @Test public void LOCAL_RECOVERY_distinctInodeAliasRefusesWithoutCleanup()throws Exception {
        try(var control=new NativePrivateCustodyFrameReadControl();var f=new GuardedIdentityFixture()){
            try(var write=f.write(0)){noAuthority(write.projection());}
            Path committed=f.dir.resolve("write-0.bin"),pending=f.dir.resolve("write-0.pending");Files.copy(committed,pending);
            Files.setPosixFilePermissions(pending,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));assertFalse(Files.isSameFile(committed,pending));
            try(var originals=new LocalFiles(f);var owner=localSavedOwner(f)){
                assertThrows(VaultFailure.class,()->f.engine.resumeSavedOriginalPrivateCustodyPieceJournals(owner,f.journal,control));originals.unchanged();
            }
        }
    }
    private static AutoCloseable controlledResume(GuardedIdentityFixture fixture,
        VaultEngine.NativePrivateCustodyPreparedExchange prepared,NativePrivateCustodyFrameReadControl control)throws Exception {
        Object kind=field(prepared,"kind"),stored=field(prepared,"stored");
        synchronized(fixture.engine){return (AutoCloseable)decisionJournalCall(fixture.journal,"resumeOriginal",
            new Class<?>[]{fixture.plan.getClass(),kind.getClass(),int.class,stored.getClass(),NativePrivateCustodyFrameReadControl.class},
            fixture.plan,kind,0,stored,control);}
    }
    @Test public void CONTROLLED_RESUME_actualPendingKeepsOriginalAndSettlesScope()throws Exception {
        try(var f=new GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            JSONObject original;try(var first=f.write(0)){original=first.projection();}
            var committed=f.dir.resolve("write-0.bin");var pending=f.dir.resolve("write-0.pending");
            byte[] bytes=Files.readAllBytes(committed);
            try{
                Files.move(committed,pending,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                var before=Files.readAttributes(pending,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                try(var restored=f.write(0);var result=controlledResume(f,restored,control)){
                    assertNotNull(result);control.check();assertFalse(Files.exists(pending));
                    assertArrayEquals(bytes,Files.readAllBytes(committed));pendingCandidateUnchanged(before,committed);
                }
                try(var current=f.write(0)){pendingWitnessUnchanged(original,current.projection());}
                assertFalse(Files.exists(f.dir.resolve("write_unknown-0.bin")));control.check();
            }finally{Arrays.fill(bytes,(byte)0);}
        }
    }
    @Test public void CONTROLLED_RESUME_sourceWithdrawalPreventsReservationAndAliasUnlink()throws Exception {
        for(boolean alias:new boolean[]{false,true})try(var f=new GuardedIdentityFixture();var control=new NativePrivateCustodyFrameReadControl()){
            try(var first=f.write(0)){noAuthority(first.projection());}
            var committed=f.dir.resolve("write-0.bin");var pending=f.dir.resolve("write-0.pending");
            if(alias)Files.createLink(pending,committed);else Files.move(committed,pending,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
            try(var restored=f.write(0);var files=new LocalFiles(f)){
                var source=f.x.f.x.f.x;String namespace="MemphisZooCustodialNativeVaultV1";var originalMap=source.unknown.get(namespace);
                var fired=new java.util.concurrent.atomic.AtomicBoolean();var sites=new java.util.HashSet<Integer>();
                source.unknown.put(namespace,new java.util.HashMap<String,Object>(originalMap){
                    @Override public java.util.Set<Map.Entry<String,Object>> entrySet(){
                        var stack=Thread.currentThread().getStackTrace();
                        if(!fired.get()&&(!alias?Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("reserveDestination")
                            &&s.getClassName().endsWith("$PendingExchangePublication")):
                            Arrays.stream(stack).anyMatch(s->s.getMethodName().equals("forceAndValidateOriginal")))){
                            for(var frame:stack)if(frame.getClassName().equals(VaultEngine.class.getName()+"$NativePrivateCustodyExchangeJournal")
                                &&frame.getMethodName().equals("resumeOriginal")){
                                sites.add(frame.getLineNumber());
                                if(fired.compareAndSet(false,true))control.requestCancellation();break;
                            }
                        }
                        return super.entrySet();
                    }
                });
                try{
                    var failure=assertThrows(VaultFailure.class,()->{try(var unexpected=controlledResume(f,restored,control)){
                        fail("Withdrawn resume returned DATA");}});
                    assertTrue("Actual internal Source boundary must be exercised",fired.get());
                    assertEquals("custodial_private_custody_transport_outcome_unknown",failure.code);
                    assertTrue("The original control refusal must survive",Arrays.stream(failure.getStackTrace()).anyMatch(s->
                        s.getClassName().equals(NativePrivateCustodyFrameReadControl.class.getName())&&s.getMethodName().equals("check")));
                    assertEquals("No repeated control failure on an already failed return",0,failure.getSuppressed().length);
                    files.unchanged();assertTrue(Files.exists(pending));assertEquals(alias,Files.exists(committed));
                    assertThrows(VaultFailure.class,()->{try(var unexpected=controlledResume(f,restored,control)){fail("Canceled scope revived");}});
                    files.unchanged();assertFalse(Files.exists(f.dir.resolve("write_unknown-0.bin")));
                    System.out.println("SOURCE_CONTROLLED_RESUME_WITHDRAWAL_"+(alias?"ALIAS_SOURCE_BEFORE_UNLINK":"PENDING_INTERNAL_SOURCE_BEFORE_ALLOCATION")+"_ORIGINALS_RETAINED_NOT_INVENTORY_AUTHORITY");
                }finally{source.unknown.put(namespace,originalMap);}
            }
        }
    }
    /** HOST crash arrangement only: move ciphertext produced by the actual
     * Engine. No valid record, token, ID, HMAC or dispatch is test-generated. */
    @Test public void PENDING_PUBLICATION_originalWriteAndUnknownKeepInodesAndWitnesses()throws Exception {
        try(var f=new GuardedIdentityFixture()){
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            var root=Files.readAttributes(f.x.f.root,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            JSONObject original;
            try(var write=f.write(0)){original=write.projection();noAuthority(original);}
            Path committed=f.dir.resolve("write-0.bin"),pending=f.dir.resolve("write-0.pending");
            Files.move(committed,pending,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
            var candidate=Files.readAttributes(pending,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            try(var recovered=f.write(0);var files=new LocalFiles(f)){
                assertEquals("PENDING",recovered.projection().get("journal_phase"));
                var promoted=f.engine.resumeOriginalPrivateCustodyPreparedExchange(recovered);
                assertEquals("COMMITTED",promoted.get("journal_phase"));assertTrue(promoted.getBoolean("original_request_record_locally_committed_observed"));
                pendingWitnessUnchanged(original,promoted);pendingFilesPromoted(files,pending,committed);
                pendingCandidateUnchanged(candidate,committed);stable.check();
            }
            try(var write=f.write(0)){
                var fenced=f.engine.fenceOriginalPrivateCustodyExchange(write);noAuthority(fenced);
                assertEquals("DISPATCH_UNKNOWN_PRESERVED_NOT_RESEND_AUTHORITY",fenced.get("state"));
                Path unknown=f.dir.resolve("write_unknown-0.bin"),unknownPending=f.dir.resolve("write_unknown-0.pending");
                Files.move(unknown,unknownPending,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
                var unknownCandidate=Files.readAttributes(unknownPending,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                try(var files=new LocalFiles(f)){
                    var before=write.projection();assertEquals("PENDING",before.get("unknown_journal_phase"));
                    assertFalse(before.getBoolean("unknown_fence_locally_committed_observed"));
                    var promoted=f.engine.resumeOriginalPrivateCustodyUnknown(write);
                    assertEquals("COMMITTED",promoted.get("unknown_journal_phase"));assertTrue(promoted.getBoolean("unknown_fence_locally_committed_observed"));
                    assertEquals("DISPATCH_UNKNOWN_PRESERVED_NOT_RESEND_AUTHORITY",promoted.get("state"));
                    pendingWitnessUnchanged(fenced,promoted);pendingFilesPromoted(files,unknownPending,unknown);
                    pendingCandidateUnchanged(unknownCandidate,unknown);stable.check();
                }
            }
            var after=Files.readAttributes(f.x.f.root,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            assertEquals(root.fileKey(),after.fileKey());assertEquals(root.owner(),after.owner());assertEquals(root.group(),after.group());assertEquals(root.permissions(),after.permissions());
            stable.check();
        }
    }
    @Test public void PENDING_PUBLICATION_unknownCommittedTargetRefusesWithoutReplacement()throws Exception {
        try(var f=new GuardedIdentityFixture()){
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);
            try(var write=f.write(0)){noAuthority(write.projection());}
            Path committed=f.dir.resolve("write-0.bin"),pending=f.dir.resolve("write-0.pending");
            Files.move(committed,pending,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
            var candidate=Files.readAttributes(pending,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            try(var recovered=f.write(0)){
                assertEquals("PENDING",recovered.projection().get("journal_phase"));
                // Opaque negative input, NOT a valid record or the publisher's
                // private reservation. A guard may refuse before publication.
                try(var unknown=java.nio.channels.FileChannel.open(committed,java.util.Set.of(java.nio.file.StandardOpenOption.WRITE,
                    java.nio.file.StandardOpenOption.CREATE_NEW,java.nio.file.LinkOption.NOFOLLOW_LINKS),
                    java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")))){
                    assertEquals(0,unknown.size());unknown.force(true);
                }
                var target=Files.readAttributes(committed,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertNotEquals(candidate.fileKey(),target.fileKey());
                try(var files=new LocalFiles(f)){
                    VaultFailure refused=assertThrows(VaultFailure.class,()->f.engine.resumeOriginalPrivateCustodyPreparedExchange(recovered));
                    assertEquals(NativeRetainedAttempt.FAILURE,refused.code);files.unchanged();
                    pendingCandidateUnchanged(candidate,pending);pendingCandidateUnchanged(target,committed);stable.check();
                }
            }
        }
    }
    private static void pendingWitnessUnchanged(JSONObject original,JSONObject actual)throws Exception {
        for(String field:new String[]{"kind","operation_id","original_generation_id","plan_sha256","frame_sha256","chunk_index","chunk_sha256",
            "write_id","attempt_id","read_query_id","native_request_id","native_request_timestamp","request_body_sha256","attestation_digest",
            "purpose_binding_sha256","prepared_record_sha256","prepared_document_sha256","target_write_record_sha256","target_unknown_record_sha256"})
            assertEquals(field,original.get(field),actual.get(field));
        noAuthority(actual);
    }
    private static void pendingCandidateUnchanged(java.nio.file.attribute.PosixFileAttributes original,Path path)throws Exception {
        var actual=Files.readAttributes(path,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
        assertTrue(actual.isRegularFile());assertFalse(actual.isSymbolicLink());assertEquals(original.fileKey(),actual.fileKey());
        assertEquals(original.size(),actual.size());assertEquals(original.lastModifiedTime(),actual.lastModifiedTime());
        assertEquals(original.owner(),actual.owner());assertEquals(original.group(),actual.group());assertEquals(original.permissions(),actual.permissions());
    }
    private static void pendingFilesPromoted(LocalFiles originals,Path source,Path destination)throws Exception {
        var wanted=new java.util.HashSet<Path>();
        for(var entry:originals.bytes.entrySet()){
            Path path=entry.getKey().equals(source)?destination:entry.getKey();wanted.add(path);
            byte[] actual=Files.readAllBytes(path);
            try{assertArrayEquals(entry.getValue(),actual);}finally{Arrays.fill(actual,(byte)0);}
            assertEquals(originals.inodes.get(entry.getKey()),Files.readAttributes(path,java.nio.file.attribute.BasicFileAttributes.class,
                java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
        }
        var actual=new java.util.HashSet<Path>();
        for(Path directory:originals.directories)try(var entries=Files.newDirectoryStream(directory)){for(Path path:entries)actual.add(path);}
        assertEquals(wanted,actual);assertFalse(Files.exists(source,java.nio.file.LinkOption.NOFOLLOW_LINKS));
    }
    static final class Fixture implements AutoCloseable {
        final NativePrivateCustodyOperationTest.Fixture x=new NativePrivateCustodyOperationTest.Fixture();
        final VaultEngine engine=x.f.engine();final VaultEngine.NativePrivateCustodyOperationObservation operation=x.prepare();
        final VaultEngine.NativePrivateCustodyChunkIdentityPlan plan=engine.prepareOriginalPrivateCustodyChunkIdentityPlan(operation);
        final VaultEngine.NativePrivateCustodyExchangeJournal journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(x.f.root.toFile());
        final Path dir=x.f.root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);final MutableClock clock;
        Fixture()throws Exception {var field=VaultEngine.class.getDeclaredField("clock");field.setAccessible(true);clock=(MutableClock)field.get(engine);}
        VaultEngine.NativePrivateCustodyPreparedExchange write(int index)throws Exception{return engine.prepareOriginalPrivateCustodyWrite(plan,journal,index);}
        VaultEngine.NativePrivateCustodyPreparedExchange query(int index)throws Exception{return engine.prepareOriginalPrivateCustodyQuery(plan,journal,index);}
        @Override public void close(){plan.close();operation.close();x.close();}
    }
    static void denied(NativeOriginalGenerationObservationTest.Action a)throws Exception{NativePrivateCustodyOwnerTest.denied(a);}
    static byte[] body(VaultEngine.NativePrivateCustodyPreparedExchange value)throws Exception {var f=value.getClass().getDeclaredField("body");f.setAccessible(true);return ((byte[])f.get(value)).clone();}
    static Object field(Object value,String name)throws Exception {var f=value.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(value);}
    static void noAuthority(JSONObject p)throws Exception {assertEquals(11,p.getInt("source_declared_native_domain_count"));assertTrue(p.getBoolean("request_purpose_and_HTTP_attestation_bound"));
        for(String flag:new String[]{"fence_PROVES_request_sent","raw_body_header_or_credential_getter","network_dispatch_allowed","writer_authority","durable_server_retention","current_server_readback","complete_namespace_inventory",
            "all_writer_durable_freeze_or_ABA_guard","actual_Android_storage_qualified","actual_Android_keystore_qualified","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(flag,p.getBoolean(flag));
        for(String text:new String[]{"body_base64","request_attestation\"","ciphertext","SYNTHETIC_LONG_DEVICE_SECRET_SOURCE_OWNER"})assertFalse(p.toString().contains(text));}
    @Test public void exactWriteBodySignaturesAndCiphertextAreRecoveredWithoutNonceTimeOrBodyRenewal()throws Exception {try(var f=new Fixture();var write=f.write(0)){
        var original=write.projection();noAuthority(original);assertEquals(f.plan.chunkMetadata(0).get("attempt_id"),original.get("native_request_id"));assertEquals("PREPARED_NOT_SENT",original.get("state"));
        byte[] bytes=body(write);try{assertEquals(NativeRetainedAttempt.hash(bytes),original.get("request_body_sha256"));var envelope=ProviderWireJson.object(bytes,NativeRetainedAttempt.MAX_BODY);
            assertEquals("custodial.original-native-private-custody-write.v1",envelope.get("schema"));assertTrue(envelope.has("purpose_attestation"));assertTrue(envelope.has("chunk_base64"));
            var files=NativePrivateCustodyOwnerTest.files(f.dir);f.clock.now+=1000;try(var recovered=f.write(0)){assertEquals(original.toString(),recovered.projection().toString());assertArrayEquals(bytes,body(recovered));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);}
        }finally{Arrays.fill(bytes,(byte)0);}
    }}
    @Test public void writeUnknownFenceIsDurableAndFreshInstancesCannotAuthorizeReplay()throws Exception {try(var f=new Fixture();var write=f.write(0)){
        var p=f.engine.fenceOriginalPrivateCustodyExchange(write);noAuthority(p);assertTrue(p.getBoolean("dispatch_unknown_fence_observed"));assertTrue(p.getBoolean("unknown_fence_locally_committed_observed"));
        var files=NativePrivateCustodyOwnerTest.files(f.dir);denied(()->f.engine.fenceOriginalPrivateCustodyExchange(write));try(var recovered=f.write(0)){assertEquals(p.toString(),recovered.projection().toString());denied(()->f.engine.fenceOriginalPrivateCustodyExchange(recovered));}NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
    }}
    @Test public void queryRequiresOriginalCommittedWriteAndUnknownNotJustPlannedIds()throws Exception {try(var f=new Fixture()){
        denied(()->f.query(0));assertFalse(Files.exists(f.dir));try(var write=f.write(0)){var files=NativePrivateCustodyOwnerTest.files(f.dir);denied(()->f.query(0));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);}
    }}
    @Test public void queryBindsExactOriginalWriteAndUnknownAndUsesOwnOnceChosenNonceAndTime()throws Exception {try(var f=new Fixture();var write=f.write(0)){
        f.engine.fenceOriginalPrivateCustodyExchange(write);var target=write.projection();f.clock.now+=1500;try(var query=f.query(0)){
            var p=query.projection();noAuthority(p);assertEquals("QUERY",p.get("kind"));assertEquals(f.plan.chunkMetadata(0).get("read_query_id"),p.get("native_request_id"));assertNotEquals(target.get("native_request_id"),p.get("native_request_id"));
            assertEquals(target.get("prepared_record_sha256"),p.get("target_write_record_sha256"));assertNotEquals(target.get("native_request_timestamp"),p.get("native_request_timestamp"));
            byte[] bytes=body(query);try {var body=ProviderWireJson.object(bytes,NativeRetainedAttempt.MAX_BODY);assertFalse(body.has("chunk_base64"));assertEquals(target.get("request_body_sha256"),body.get("target_request_body_sha256"));
                var files=NativePrivateCustodyOwnerTest.files(f.dir);f.clock.now+=1200;try(var recovered=f.query(0)){assertEquals(p.toString(),recovered.projection().toString());assertArrayEquals(bytes,body(recovered));}NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
            }finally{Arrays.fill(bytes,(byte)0);}
        }
    }}
    @Test public void queryUnknownAndStaleRecoveryNeverBecomeFreshReplacementQuery()throws Exception {try(var f=new Fixture();var write=f.write(0)){
        f.engine.fenceOriginalPrivateCustodyExchange(write);try(var query=f.query(0)){f.engine.fenceOriginalPrivateCustodyExchange(query);var p=query.projection();var files=NativePrivateCustodyOwnerTest.files(f.dir);f.clock.now+=86400000;
            try(var recovered=f.query(0)){assertEquals(p.toString(),recovered.projection().toString());denied(()->f.engine.fenceOriginalPrivateCustodyExchange(recovered));}NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);}
    }}
    @Test public void staleOrTooFarFutureWriteIsPreservedAndRefusedBeforeUnknownFence()throws Exception {try(var f=new Fixture();var write=f.write(0)){
        var p=write.projection();var files=NativePrivateCustodyOwnerTest.files(f.dir);long initial=f.clock.now;f.clock.now=initial+120001;denied(()->f.engine.fenceOriginalPrivateCustodyExchange(write));
        try(var original=f.write(0)){assertEquals(p.toString(),original.projection().toString());f.clock.now=initial-15001;denied(()->f.engine.fenceOriginalPrivateCustodyExchange(original));}NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
    }}
    @Test public void pendingPreparedAndPendingUnknownRecoverOnlySameCiphertextExplicitly()throws Exception {try(var f=new Fixture()){
        JSONObject p;try(var write=f.write(0)){p=write.projection();}Path committed=f.dir.resolve("write-0.bin"),pending=f.dir.resolve("write-0.pending");byte[] original=Files.readAllBytes(committed);Files.move(committed,pending);
        try(var recovered=f.write(0)){assertFalse(recovered.projection().getBoolean("original_request_record_locally_committed_observed"));denied(()->f.engine.fenceOriginalPrivateCustodyExchange(recovered));
            f.engine.resumeOriginalPrivateCustodyPreparedExchange(recovered);assertEquals(p.get("native_request_id"),recovered.projection().get("native_request_id"));assertEquals(p.get("native_request_timestamp"),recovered.projection().get("native_request_timestamp"));assertArrayEquals(original,Files.readAllBytes(committed));}
        try(var write=f.write(0)){f.engine.fenceOriginalPrivateCustodyExchange(write);Path c=f.dir.resolve("write_unknown-0.bin"),q=f.dir.resolve("write_unknown-0.pending");byte[] fence=Files.readAllBytes(c);Files.move(c,q);
            assertFalse(write.projection().getBoolean("unknown_fence_locally_committed_observed"));denied(()->f.query(0));f.engine.resumeOriginalPrivateCustodyUnknown(write);assertArrayEquals(fence,Files.readAllBytes(c));
            denied(()->f.engine.fenceOriginalPrivateCustodyExchange(write));try(var query=f.query(0)){noAuthority(query.projection());}Arrays.fill(fence,(byte)0);}
        Arrays.fill(original,(byte)0);
    }}
    @Test public void corruptedPreparedOrUnknownIsPreservedAndBlocksRecoveryAndQuery()throws Exception {try(var f=new Fixture();var write=f.write(0)){
        Path p=f.dir.resolve("write-0.bin");byte[] corrupt=Files.readAllBytes(p);corrupt[0]^=1;Files.write(p,corrupt);denied(write::projection);denied(()->f.write(0));assertArrayEquals(corrupt,Files.readAllBytes(p));Arrays.fill(corrupt,(byte)0);
    }try(var f=new Fixture();var write=f.write(0)){f.engine.fenceOriginalPrivateCustodyExchange(write);Path p=f.dir.resolve("write_unknown-0.bin");byte[] corrupt=Files.readAllBytes(p);corrupt[0]^=1;Files.write(p,corrupt);denied(()->f.query(0));assertArrayEquals(corrupt,Files.readAllBytes(p));Arrays.fill(corrupt,(byte)0);}}
    @Test public void cachedRequestTamperingAndChangedQueryTargetRefuseWithoutRepair()throws Exception {try(var f=new Fixture();var write=f.write(0)){
        var files=NativePrivateCustodyOwnerTest.files(f.dir);byte[] owned=(byte[])field(write,"body");owned[0]^=1;denied(write::projection);denied(()->f.engine.fenceOriginalPrivateCustodyExchange(write));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
    }try(var f=new Fixture();var write=f.write(0)){f.engine.fenceOriginalPrivateCustodyExchange(write);try(var query=f.query(0)){Path p=f.dir.resolve("write_unknown-0.bin");byte[] corrupt=Files.readAllBytes(p);corrupt[0]^=1;Files.write(p,corrupt);denied(query::projection);denied(()->f.engine.fenceOriginalPrivateCustodyExchange(query));assertArrayEquals(corrupt,Files.readAllBytes(p));Arrays.fill(corrupt,(byte)0);}}}
    @Test public void unknownArtifactBusyLockAndDifferentInodeAliasCannotBeSilentlyRepaired()throws Exception {try(var f=new Fixture();var write=f.write(0)){
        try(var c=java.nio.channels.FileChannel.open(f.dir.resolve("exchange.lock"),java.nio.file.StandardOpenOption.WRITE);var lock=c.lock()){denied(write::projection);}
        Files.copy(f.dir.resolve("write-0.bin"),f.dir.resolve("write-0.pending"));Files.setPosixFilePermissions(f.dir.resolve("write-0.pending"),java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));var files=NativePrivateCustodyOwnerTest.files(f.dir);denied(()->f.write(0));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
    }try(var f=new Fixture();var write=f.write(0)){Files.writeString(f.dir.resolve("unexpected.bin"),"synthetic");var files=NativePrivateCustodyOwnerTest.files(f.dir);denied(write::projection);denied(()->f.write(0));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);}}
    @Test public void changedOriginalNamespaceOrKeyInvalidatesAllPreparedEvidenceWithoutDeletingIt()throws Exception {try(var f=new Fixture();var write=f.write(0)){
        var files=NativePrivateCustodyOwnerTest.files(f.dir);f.x.f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("exchange-new-unknown","synthetic");denied(write::projection);denied(()->f.write(0));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
    }try(var f=new Fixture();var write=f.write(0)){var files=NativePrivateCustodyOwnerTest.files(f.dir);NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);denied(write::projection);denied(()->f.write(0));NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);}}
    @Test public void closeWipesOnlyOwnRequestAndPerChunkRecordsKeepSharedOriginalIdentity()throws Exception {try(var f=new Fixture()){
        var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x.f.x);var original=NativePrivateCustodyOwnerTest.files(f.x.f.dir);
        for(int i=0;i<f.plan.projection().getInt("chunk_count");i++){var write=f.write(i);byte[] owned=(byte[])field(write,"body");var p=write.projection();assertEquals(f.plan.projection().get("operation_id"),p.get("operation_id"));assertEquals(f.plan.chunkMetadata(i).get("attempt_id"),p.get("native_request_id"));write.close();assertArrayEquals(new byte[owned.length],owned);denied(write::projection);}
        stable.check();NativePrivateCustodyOwnerTest.sameFiles(original,f.x.f.dir);f.plan.projection();
    }}
}
