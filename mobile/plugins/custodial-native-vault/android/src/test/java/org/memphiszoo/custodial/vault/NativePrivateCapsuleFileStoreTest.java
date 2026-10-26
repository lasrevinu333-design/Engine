package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** NEW actual owning HOST temporary-filesystem protocol cases ONLY. Native
 * values/enrollment/key/HMAC/provider admission are synthetic fixtures; no
 * real Android filesystem, phone, original credential, network or old rerun.
 * Fixture root is supplied by the one-shot qualifier; originals are retained.
 */
public final class NativePrivateCapsuleFileStoreTest {
    /** The uncontrolled-entry selector is preserved. The separate named
     * typed selector runs only format members whose writer fixture changed;
     * neither selector starts an unrelated owner or custody suite. */
    public static void main(String[] args)throws Exception {
        if(args.length==2&&"--pending-capsule-publication-only".equals(args[0])){
            if(!java.util.Set.of("normalPendingPublicationPreservesOriginalInodeWithoutAliasCleanup",
                "normalPendingPublicationRefusesUnknownPreexistingTargetWithoutOverwrite").contains(args[1]))
                throw new IllegalArgumentException("Select a new pending capsule publication member");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCapsuleFileStoreTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("SOURCE_HOST_PENDING_CAPSULE_PUBLICATION "+args[1]);
            System.out.println("SYNTHETIC_HOST_INPUT_ONLY; NO_ANDROID_OR_ACK");return;
        }
        if(args.length==2&&"--typed-capsule-format-only".equals(args[0])){
            if(!java.util.Set.of(
                "exactNativeFileRetentionWritesOnlyPrivateEncryptedRecordAndInventoriesFixedArtifacts",
                "reopeningFixedAdapterRestoresOriginalBytesWithoutReplacementCapsuleOrRewrite",
                "completePendingCrashStatePromotesOnlySameOriginalRecordAfterExplicitRecovery",
                "crashAfterAbsentOnlyHardlinkKeepsSameInodeCommittedAndRemovesOnlyExactPendingAlias",
                "mixedDistinctPendingAndCommittedEvenSameBytesRefuseWithoutChoosingLatestOrDeletingEither",
                "partialCorruptPendingRemainsUnknownRetainedAndCannotBeOverwrittenByFreshValidCapsule",
                "freshRandomIvCapsuleCannotReplaceExistingSameValueBindingMustRecoverOriginal",
                "pendingSymlinkAndUnexpectedFilesRefuseNoFollowAndDoNotTouchOwnedSentinel",
                "activeJournalLockFailsImmediatelyWithoutNewFileWritesOrRetryingAnotherController",
                "broaderExistingModeOrNonemptyLockRemainRetainedNoPermissionRepairOrOverwrite",
                "oversizedExistingCiphertextRefusesBeforeAllocationAndDoesNotTruncateUnknownFile",
                "wrongRecoveryKeyAndClosingObservationKeepOriginalCiphertextAndNativeOwners"
            ).contains(args[1]))throw new IllegalArgumentException("Select an affected typed capsule format member");
            var result=new org.junit.runner.JUnitCore().run(
                org.junit.runner.Request.method(NativePrivateCapsuleFileStoreTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());
                throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_TYPED_CAPSULE_FORMAT "+args[1]);
            System.out.println("SYNTHETIC_ORIGINAL_KEY_AND_HOST_FILES_ONLY; NO_ANDROID_OR_ACK");return;
        }
        if(args.length!=1||!"--uncontrolled-capsule-entry-only".equals(args[0]))
            throw new IllegalArgumentException("Select the new uncontrolled capsule entry case");
        new NativePrivateCapsuleFileStoreTest().uncontrolledEntryRefusesBeforeCreatingAnyArtifact();
        System.out.println("NEW_CAPSULE_UNCONTROLLED_ENTRY_REFUSED_NO_ARTIFACTS");
        System.out.println("SOURCE_HOST_ONLY; TYPED_ENGINE_RETENTION_AND_ANDROID_NOT_REPLAYED; NO_ACK_OR_FINALIZER");
    }
    @Test public void uncontrolledEntryRefusesBeforeCreatingAnyArtifact()throws Exception {
        try(var f=new Fixture()){
            var original=f.capsule.metadata().toString();boolean refused=false;
            try(var unowned=f.store.retainExactOriginal(f.capsule)){
                System.out.println("UNCONTROLLED_CAPSULE_ENTRY_EFFECT directory="+Files.exists(f.directory)
                    +" committed="+Files.exists(f.committed)+" pending="+Files.exists(f.pending));
            }catch(VaultFailure failure){assertEquals(NativePrivateCapsuleFileStore.FAILURE,failure.code);refused=true;}
            assertTrue("A format-valid capsule cannot replace the Engine's live retention control",refused);
            assertFalse("No uncontrolled store directory may be created",Files.exists(f.directory));
            assertEquals(original,f.capsule.metadata().toString());
            denied(()->f.store.retainExactOriginal(null));
            assertFalse(Files.exists(f.directory));
            f.capsule.close();denied(()->f.store.retainExactOriginal(f.capsule));
            assertFalse(Files.exists(f.directory));
        }
    }
    static final class Fixture implements AutoCloseable {
        final NativeRetainedNamespaceCustodyLayoutTest.Fixture x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();
        final NativeRetainedNamespaceSemanticJoinTest.Fixture f=x.f;
        final VaultEngine.NativeRetainedGenerationObservation g;
        final NativeProtectedNamespaceObservation n;
        final VaultEngine.NativeRetainedNamespaceValueObservation v;
        final VaultEngine.NativeRetainedNamespaceSemanticObservation s;
        final VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation l;
        final NativeRetainedNamespacePrivateCapsule capsule;
        final Path root,directory,committed,pending,lock;
        final NativePrivateCapsuleFileStore store;
        Fixture()throws Exception {
            String property=System.getProperty("custodial.custody.fixture.root");if(property==null)throw new AssertionError("own fixture root required");
            root=Files.createTempDirectory(Path.of(property),"case-",PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            directory=root.resolve(NativePrivateCapsuleFileStore.DIRECTORY);committed=directory.resolve(NativePrivateCapsuleFileStore.COMMITTED);
            pending=directory.resolve(NativePrivateCapsuleFileStore.PENDING);lock=directory.resolve(NativePrivateCapsuleFileStore.LOCK);
            store=NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(root.toFile());g=f.x.f.generation();n=f.x.observe();v=f.values(g,n);s=f.join(v);l=x.layout(s);
            capsule=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));
        }
        @Override public void close(){capsule.close();l.close();s.close();v.close();n.close();g.close();f.x.f.preserved();}
    }
    /** Actual existing Engine fixture owns the original actor/all8/layout/key.
     * No private control or capsule constructor is reflected or supplied.
     * The raw Fixture above remains ONLY for read-only/retired-entry cases. */
    static final class TypedFixture implements AutoCloseable {
        final NativePrivateCustodyOwnerTest.Fixture owner=new NativePrivateCustodyOwnerTest.Fixture();
        final NativeRetainedNamespaceSemanticJoinTest.Fixture f=owner.x.f;
        final VaultEngine.NativeRetainedNamespaceValueObservation v=owner.h.v;
        final VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation l=owner.h.l;
        final Path root=owner.root,directory=owner.dir,committed=owner.committed,pending=owner.pending,
            lock=directory.resolve(NativePrivateCapsuleFileStore.LOCK);
        final NativePrivateCapsuleFileStore store=owner.store;
        final VaultEngine.NativeRetainedNamespacePrivateCapsuleObservation capsule;
        TypedFixture()throws Exception {capsule=engine().prepareOriginalRetainedNamespacePrivateCapsule(l);}
        VaultEngine engine(){return owner.engine();}
        VaultEngine.NativePrivateCustodyObservation retain(
            VaultEngine.NativeRetainedNamespacePrivateCapsuleObservation original)throws VaultFailure {
            // The existing Engine mints and closes its private store control.
            try(var invocation=new NativePrivateCustodyFrameReadControl()){
                return engine().retainOriginalPrivateCustody(original,store,invocation);
            }
        }
        void commit()throws Exception {
            try(var receipt=retain(capsule);var file=store.inspectExisting()){
                NativePrivateCustodyOwnerTest.noAuthority(receipt.projection());noAuthority(file.metadata());
            }
        }
        VaultEngine.NativePrivateCustodyObservation recover(
            NativePrivateCapsuleFileStore.Existing original,int key)throws Exception {
            return recover(original,key,store);
        }
        VaultEngine.NativePrivateCustodyObservation recover(
            NativePrivateCapsuleFileStore.Existing original,int key,NativePrivateCapsuleFileStore target)throws Exception {
            original.metadata();
            // Existing synthetic adapter's negative-key selector ONLY; no
            // production key reset/replacement, new key, or crypto override.
            if(key!=1)NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},key);
            VaultEngine.NativePrivateCustodyObservation observed=null;
            try{
                observed=engine().inspectOriginalPrivateCustody(l,target);
                original.metadata();return observed;
            }catch(Exception failure){if(observed!=null)observed.close();throw failure;}
            finally{if(key!=1)NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},1);}
        }
        @Override public void close(){capsule.close();owner.close();}
    }
    static String recoveredPhase(VaultEngine.NativePrivateCustodyObservation observation)throws Exception {
        return observation.projection().getJSONObject("additional_protected_file_domain").getString("phase");
    }
    static void denied(NativeOriginalGenerationObservationTest.Action action)throws Exception{NativeRetainedNamespacePrivateCapsuleTest.denied(action);}
    static void noAuthority(JSONObject p)throws Exception{
        for(String flag:new String[]{"actual_Android_storage_qualified","durable_retention","complete_namespace_inventory","all_native_storage_inventory_complete",
            "all_writer_durable_freeze_or_ABA_guard","current_server_readback","work_accepted","inventory_acknowledged","resend_allowed","finalizer_allowed","key_removal"})assertFalse(flag,p.getBoolean(flag));
        assertTrue(p.getBoolean("additional_protected_storage_declared"));assertEquals(3,p.getJSONArray("fixed_artifact_names").length());
    }
    static Map<String,byte[]> snapshot(Path directory)throws Exception {
        Map<String,byte[]> result=new HashMap<>();try(var entries=Files.newDirectoryStream(directory)){
            for(Path file:entries)if(!Files.isSymbolicLink(file))result.put(file.getFileName().toString(),Files.readAllBytes(file));
        }return result;
    }
    static Map<String,Object> fileKeys(Path directory)throws Exception {
        Map<String,Object> result=new HashMap<>();try(var entries=Files.newDirectoryStream(directory)){
            for(Path file:entries){
                Object key=Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey();assertNotNull(key);
                result.put(file.getFileName().toString(),key);
            }
        }return result;
    }
    static void same(Map<String,byte[]> expected,Path directory)throws Exception{var actual=snapshot(directory);assertEquals(expected.keySet(),actual.keySet());for(String name:expected.keySet())assertArrayEquals(name,expected.get(name),actual.get(name));}
    @Test public void absentReadCreatesNoProtectedDirectoryOrLockAndDoesNotClaimAbsenceAuthority()throws Exception {
        try(var f=new Fixture()){var stable=new NativeRetainedNamespaceCensusTest.Stable(f.f.x);try(var o=f.store.inspectExisting()){
            assertEquals("ABSENT_NO_STORAGE_CREATED",o.phase);noAuthority(o.metadata());assertFalse(Files.exists(f.directory));denied(o::originalEncryptedRecord);stable.check();}}
    }
    @Test public void exactNativeFileRetentionWritesOnlyPrivateEncryptedRecordAndInventoriesFixedArtifacts()throws Exception {
        try(var f=new TypedFixture()){var stable=new NativeRetainedNamespaceCensusTest.Stable(f.f.x);f.commit();assertTrue(Files.exists(f.committed));assertFalse(Files.exists(f.pending));
            assertEquals(0,Files.size(f.lock));assertEquals(PosixFilePermissions.fromString("rwx------"),Files.getPosixFilePermissions(f.directory));
            assertEquals(PosixFilePermissions.fromString("rw-------"),Files.getPosixFilePermissions(f.committed));
            try(var o=f.store.inspectExisting();var restored=f.recover(o,1)){assertEquals(f.capsule.projection().get("capsule_sha256"),restored.projection().getJSONObject("capsule").get("capsule_sha256"));
                noAuthority(o.metadata());NativeRetainedNamespacePrivateCapsuleTest.noAuthority(restored.projection().getJSONObject("capsule"));}
            String encrypted=new String(Files.readAllBytes(f.committed),java.nio.charset.StandardCharsets.ISO_8859_1);assertFalse(encrypted.contains("synthetic-batch-token-one"));stable.check();}
    }
    @Test public void reopeningFixedAdapterRestoresOriginalBytesWithoutReplacementCapsuleOrRewrite()throws Exception {
        try(var f=new TypedFixture()){f.commit();var saved=snapshot(f.directory);var savedKeys=fileKeys(f.directory);Object inode=Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            var fresh=NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(f.root.toFile());try(var o=fresh.inspectExisting();var restored=f.recover(o,1,fresh);var receipt=f.engine().resumeOriginalPrivateCustody(restored)){
                // Engine returns authenticated read metadata, not the retired writer receipt phase.
                assertEquals("OPAQUE_COMMITTED_REQUIRES_ORIGINAL_RECOVERY",recoveredPhase(receipt));assertEquals(f.capsule.projection().get("capsule_sha256"),restored.projection().getJSONObject("capsule").get("capsule_sha256"));same(saved,f.directory);assertEquals(savedKeys,fileKeys(f.directory));
                assertEquals(inode,Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());}
        }
    }
    @Test public void completePendingCrashStatePromotesOnlySameOriginalRecordAfterExplicitRecovery()throws Exception {
        try(var f=new TypedFixture()){f.commit();byte[] saved=Files.readAllBytes(f.committed);Files.move(f.committed,f.pending);
            Object pendingInode=Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            try(var pending=f.store.inspectExisting()){assertEquals("OPAQUE_PENDING_REQUIRES_ORIGINAL_RECOVERY",pending.phase);assertFalse(Files.exists(f.committed));
                try(var restored=f.recover(pending,1);var result=f.engine().resumeOriginalPrivateCustody(restored)){assertEquals("OPAQUE_COMMITTED_REQUIRES_ORIGINAL_RECOVERY",recoveredPhase(result));}}
            assertArrayEquals(saved,Files.readAllBytes(f.committed));assertFalse(Files.exists(f.pending));assertEquals(pendingInode,Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());}
    }
    @Test public void crashAfterAbsentOnlyHardlinkKeepsSameInodeCommittedAndRemovesOnlyExactPendingAlias()throws Exception {
        try(var f=new TypedFixture()){f.commit();Files.createLink(f.pending,f.committed);byte[] saved=Files.readAllBytes(f.committed);
            Object inode=Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            try(var o=f.store.inspectExisting()){assertEquals("OPAQUE_COMMITTED_WITH_SAME_INODE_PENDING_REQUIRES_ORIGINAL_RECOVERY",o.phase);assertTrue(Files.exists(f.pending));
                try(var restored=f.recover(o,1);var result=f.engine().resumeOriginalPrivateCustody(restored)){assertEquals("OPAQUE_COMMITTED_REQUIRES_ORIGINAL_RECOVERY",recoveredPhase(result));}}
            assertFalse(Files.exists(f.pending));assertArrayEquals(saved,Files.readAllBytes(f.committed));assertEquals(inode,Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());}
    }
    @Test public void mixedDistinctPendingAndCommittedEvenSameBytesRefuseWithoutChoosingLatestOrDeletingEither()throws Exception {
        try(var f=new TypedFixture()){f.commit();Files.copy(f.committed,f.pending,java.nio.file.StandardCopyOption.COPY_ATTRIBUTES);assertFalse(Files.isSameFile(f.pending,f.committed));
            var saved=snapshot(f.directory);var savedKeys=fileKeys(f.directory);denied(f.store::inspectExisting);denied(()->f.retain(f.capsule));same(saved,f.directory);assertEquals(savedKeys,fileKeys(f.directory));}
    }
    @Test public void partialCorruptPendingRemainsUnknownRetainedAndCannotBeOverwrittenByFreshValidCapsule()throws Exception {
        try(var f=new TypedFixture()){f.commit();Files.move(f.committed,f.pending);byte[] original=Files.readAllBytes(f.pending);
            Files.write(f.pending,Arrays.copyOf(original,original.length/2),StandardOpenOption.TRUNCATE_EXISTING);var saved=snapshot(f.directory);var savedKeys=fileKeys(f.directory);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.f.x);denied(f.store::inspectExisting);denied(()->f.retain(f.capsule));same(saved,f.directory);assertEquals(savedKeys,fileKeys(f.directory));stable.check();assertFalse(Files.exists(f.committed));}
    }
    @Test public void freshRandomIvCapsuleCannotReplaceExistingSameValueBindingMustRecoverOriginal()throws Exception {
        try(var f=new TypedFixture()){f.commit();var saved=snapshot(f.directory);var savedKeys=fileKeys(f.directory);
            try(var replacement=f.engine().prepareOriginalRetainedNamespacePrivateCapsule(f.l)){
                assertNotEquals(f.capsule.projection().get("capsule_sha256"),replacement.projection().get("capsule_sha256"));denied(()->f.retain(replacement));same(saved,f.directory);assertEquals(savedKeys,fileKeys(f.directory));}
        }
    }
    @Test public void pendingSymlinkAndUnexpectedFilesRefuseNoFollowAndDoNotTouchOwnedSentinel()throws Exception {
        try(var f=new TypedFixture()){f.commit();Path sentinel=f.root.resolve("owned-sentinel");byte[] original="owned-negative-test".getBytes(java.nio.charset.StandardCharsets.UTF_8);Files.write(sentinel,original,StandardOpenOption.CREATE_NEW);
            Files.createSymbolicLink(f.pending,sentinel);byte[] committed=Files.readAllBytes(f.committed);var originalKeys=fileKeys(f.directory);denied(f.store::inspectExisting);denied(()->f.retain(f.capsule));
            assertTrue(Files.isSymbolicLink(f.pending));assertArrayEquals(original,Files.readAllBytes(sentinel));assertArrayEquals(committed,Files.readAllBytes(f.committed));assertEquals(originalKeys,fileKeys(f.directory));}
        try(var f=new TypedFixture()){f.commit();Path extra=f.directory.resolve("unknown-owner-record");Files.write(extra,new byte[]{1,2,3},StandardOpenOption.CREATE_NEW);var saved=snapshot(f.directory);var savedKeys=fileKeys(f.directory);
            denied(f.store::inspectExisting);denied(()->f.retain(f.capsule));same(saved,f.directory);assertEquals(savedKeys,fileKeys(f.directory));}
    }
    @Test public void symlinkedRootAndAmbiguousRelativeRootCannotCreateAnyStorage()throws Exception {
        try(var f=new Fixture()){Path link=f.root.getParent().resolve(f.root.getFileName()+"-link");Files.createSymbolicLink(link,f.root);
            denied(()->NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(link.toFile()));denied(()->NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(new java.io.File("relative-owned-test")));
            assertFalse(Files.exists(f.directory));}
    }
    @Test public void activeJournalLockFailsImmediatelyWithoutNewFileWritesOrRetryingAnotherController()throws Exception {
        try(var f=new TypedFixture()){f.commit();var saved=snapshot(f.directory);var savedKeys=fileKeys(f.directory);try(FileChannel held=FileChannel.open(f.lock,StandardOpenOption.WRITE);FileLock lock=held.lock()){
            denied(f.store::inspectExisting);denied(()->f.retain(f.capsule));same(saved,f.directory);assertEquals(savedKeys,fileKeys(f.directory));}
        }
    }
    @Test public void broaderExistingModeOrNonemptyLockRemainRetainedNoPermissionRepairOrOverwrite()throws Exception {
        try(var f=new TypedFixture()){f.commit();Files.setPosixFilePermissions(f.committed,PosixFilePermissions.fromString("rw-r-----"));var saved=snapshot(f.directory);var savedKeys=fileKeys(f.directory);
            denied(f.store::inspectExisting);denied(()->f.retain(f.capsule));same(saved,f.directory);assertEquals(savedKeys,fileKeys(f.directory));assertEquals(PosixFilePermissions.fromString("rw-r-----"),Files.getPosixFilePermissions(f.committed));}
        try(var f=new TypedFixture()){f.commit();Files.write(f.lock,new byte[]{7},StandardOpenOption.TRUNCATE_EXISTING);var saved=snapshot(f.directory);var savedKeys=fileKeys(f.directory);
            denied(f.store::inspectExisting);denied(()->f.retain(f.capsule));same(saved,f.directory);assertEquals(savedKeys,fileKeys(f.directory));}
    }
    @Test public void oversizedExistingCiphertextRefusesBeforeAllocationAndDoesNotTruncateUnknownFile()throws Exception {
        try(var f=new TypedFixture()){f.commit();try(var oversized=new java.io.RandomAccessFile(f.committed.toFile(),"rw")){oversized.setLength((long)NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES+1);}
            Object inode=Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            long size=Files.size(f.committed);denied(f.store::inspectExisting);denied(()->f.retain(f.capsule));assertEquals(size,Files.size(f.committed));assertEquals(inode,Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());}
    }
    @Test public void wrongRecoveryKeyAndClosingObservationKeepOriginalCiphertextAndNativeOwners()throws Exception {
        try(var f=new TypedFixture()){f.commit();var saved=snapshot(f.directory);var savedKeys=fileKeys(f.directory);var stable=new NativeRetainedNamespaceCensusTest.Stable(f.f.x);
            var observation=f.store.inspectExisting();denied(()->f.recover(observation,2));
            try(var restored=f.recover(observation,1)){
                restored.close();denied(restored::projection);denied(()->f.engine().resumeOriginalPrivateCustody(restored));
            }
            observation.close();denied(observation::originalEncryptedRecord);
            same(saved,f.directory);assertEquals(savedKeys,fileKeys(f.directory));assertNotNull(f.l.projection());assertNotNull(f.v.projection());stable.check();}
    }

    @Test public void normalPendingPublicationPreservesOriginalInodeWithoutAliasCleanup()throws Exception {
        try(var f=new TypedFixture()){
            // Arrange a pending crash image by moving ONLY the actual record
            // just created by the real typed Engine retention fixture. No
            // caller-valid metadata/token or replacement ciphertext is seeded.
            f.commit();Files.move(f.committed,f.pending);
            var pending=Files.readAttributes(f.pending,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var lock=Files.readAttributes(f.lock,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            var directory=Files.readAttributes(f.directory,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
            byte[] original=Files.readAllBytes(f.pending);assertNotNull(pending.fileKey());
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.f.x);
            try {
                assertTrue(Files.notExists(f.committed,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                try(var saved=f.store.inspectExisting();var recovered=f.recover(saved,1);
                    var promoted=f.engine().resumeOriginalPrivateCustody(recovered)){
                    assertEquals("OPAQUE_PENDING_REQUIRES_ORIGINAL_RECOVERY",saved.phase);
                    assertEquals("OPAQUE_COMMITTED_REQUIRES_ORIGINAL_RECOVERY",recoveredPhase(promoted));
                    NativePrivateCustodyOwnerTest.noAuthority(promoted.projection());
                }
                assertTrue(Files.notExists(f.pending,java.nio.file.LinkOption.NOFOLLOW_LINKS));
                byte[] readback=Files.readAllBytes(f.committed);
                try {assertArrayEquals(original,readback);}finally{Arrays.fill(readback,(byte)0);}
                var after=Files.readAttributes(f.committed,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(pending.fileKey(),after.fileKey());assertEquals(pending.size(),after.size());assertEquals(pending.lastModifiedTime(),after.lastModifiedTime());
                assertEquals(pending.owner(),after.owner());assertEquals(pending.group(),after.group());assertEquals(pending.permissions(),after.permissions());
                assertEquals(PosixFilePermissions.fromString("rw-------"),after.permissions());
                var names=new java.util.HashSet<String>();
                try(var entries=Files.newDirectoryStream(f.directory)){for(Path file:entries)names.add(file.getFileName().toString());}
                assertEquals(java.util.Set.of(NativePrivateCapsuleFileStore.COMMITTED,NativePrivateCapsuleFileStore.LOCK),names);
                var lockAfter=Files.readAttributes(f.lock,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(lock.fileKey(),lockAfter.fileKey());assertEquals(0L,lockAfter.size());assertEquals(lock.permissions(),lockAfter.permissions());
                var directoryAfter=Files.readAttributes(f.directory,java.nio.file.attribute.PosixFileAttributes.class,java.nio.file.LinkOption.NOFOLLOW_LINKS);
                assertEquals(directory.fileKey(),directoryAfter.fileKey());assertEquals(directory.owner(),directoryAfter.owner());
                assertEquals(directory.group(),directoryAfter.group());assertEquals(directory.permissions(),directoryAfter.permissions());stable.check();
            } finally {Arrays.fill(original,(byte)0);}
            // Leaves original committed ciphertext/keys; no retry/cleanup IO.
        }
    }

    @Test public void normalPendingPublicationRefusesUnknownPreexistingTargetWithoutOverwrite()throws Exception {
        try(var f=new TypedFixture()){
            f.commit();Files.move(f.committed,f.pending);
            // Negative unknown input ONLY. An empty target is not a capsule,
            // an owned reservation, or authority to replace a preexisting file.
            try(var unknown=FileChannel.open(f.committed,java.util.Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,
                java.nio.file.LinkOption.NOFOLLOW_LINKS),PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
                assertEquals(0L,unknown.size());
            }
            var originals=snapshot(f.directory);var keys=fileKeys(f.directory);
            var stable=new NativeRetainedNamespaceCensusTest.Stable(f.f.x);
            try {
                VaultFailure refused=assertThrows(VaultFailure.class,()->{try(var unexpected=f.retain(f.capsule)){fail("Unknown target must not be adopted or overwritten");}});
                assertEquals(NativePrivateCapsuleFileStore.FAILURE,refused.code);
                assertEquals(keys,fileKeys(f.directory));
                for(String name:originals.keySet()){
                    byte[] readback=Files.readAllBytes(f.directory.resolve(name));
                    try {assertArrayEquals(originals.get(name),readback);}finally{Arrays.fill(readback,(byte)0);}
                }
                assertEquals(0L,Files.size(f.committed));assertTrue(Files.exists(f.pending,java.nio.file.LinkOption.NOFOLLOW_LINKS));stable.check();
            } finally {for(byte[] bytes:originals.values())Arrays.fill(bytes,(byte)0);}
            // Refusal may precede publisher entry; not a raced-IO/crash proof.
            // Both unknown target and original pending remain untouched.
        }
    }
}
