package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** NEW owning Engine/current-all8/fixed-file coordination cases. Qualifier
 * substitutes ONLY Android key adapter in a separate owned test-copy class
 * directory with explicit synthetic JCE key/envelope. Actual Android adapter
 * is compiled unchanged separately, NOT executed/platform-qualified. Original
 * prefs/auth/provider/clock are synthetic; actual host file effects only.
 */
public final class NativePrivateCustodyOwnerTest {
    // Only the NEW capsule file-force recovery cases run through this selector.
    public static void main(String[] args)throws Exception {
        if(args.length==2&&args[0].equals("--capsule-invocation-lifetime-only")){
            if(!java.util.Set.of("INVOCATION_RETENTION_liveFiniteControlRetainsWithoutAuthority",
                "INVOCATION_RETENTION_canceledOrNullRefusesBeforeWrite",
                "INVOCATION_RETENTION_initialForceCancelPreservesPending",
                "INVOCATION_RETENTION_postLinkCancelPreservesBothOriginalLinks").contains(args[1]))throw new AssertionError("affected invocation member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOwnerTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_CAPSULE_INVOCATION "+args[1]);return;
        }
        if(args.length==2&&args[0].equals("--capsule-retention-control-only")){
            if(!java.util.Set.of("capturedPendingOwnerChangeAfterForcePreservesOriginal",
                "retentionControlInitialForceWithdrawalKeepsPending",
                "retentionControlAliasForceWithdrawalKeepsBothOriginalLinks",
                "retentionControlPostLinkWithdrawalKeepsBothOriginalLinks").contains(args[1]))throw new AssertionError("affected retention-control member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOwnerTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_RETENTION_CONTROL "+args[1]);return;
        }
        if(args.length==2&&args[0].equals("--captured-capsule-file-identity-only")){
            if(!java.util.Set.of("capturedCapsuleRefusesSameBytesReplacementInode",
                "capturedCapsuleUnchangedReadbackRetainsClosedSchema",
                "capturedCapsuleRefusesRootDirectoryAndLockReplacement",
                "capturedPendingOwnerChangeAfterForcePreservesOriginal").contains(args[1]))throw new AssertionError("affected identity member required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativePrivateCustodyOwnerTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_SOURCE_HOST_CAPTURED_IDENTITY "+args[1]);return;
        }
        if(args.length==1&&args[0].equals("--captured-capsule-file-identity-only")){
            new NativePrivateCustodyOwnerTest().capturedCapsuleRefusesSameBytesReplacementInode();
            System.out.println("PASS_SOURCE_HOST_CAPTURED_CAPSULE_FILE_IDENTITY");return;
        }
        if(args.length!=1||!args[0].equals("--capsule-recovery-force-only"))throw new AssertionError("selector required");
        var test=new NativePrivateCustodyOwnerTest();
        for(String name:new String[]{"pendingForceFailureRecoveryForcesSameCapsuleBeforeLink","sameInodeAliasForcesOriginalBeforeAliasDeletion",
            "recoveredCapsuleForceFailuresPreservePendingAndAlias","recoveredCapsuleLinkFailuresKeepExactOriginalRecoverable",
            "postForceChangedInodeOrCiphertextRefusesPromotion","closedRecoveredCapsuleAfterForceRefusesPromotion"}) {
            try{NativePrivateCustodyOwnerTest.class.getMethod(name).invoke(test);System.out.println("PASS "+name);}
            catch(java.lang.reflect.InvocationTargetException e){System.out.println("FAIL "+name+" "+e.getCause().getClass().getSimpleName());throw e;}
        }
    }
    @Test public void capturedCapsuleRefusesSameBytesReplacementInode()throws Exception {
        try(var f=new Fixture()){
            f.commit();byte[] original=Files.readAllBytes(f.committed);
            try(var captured=f.inspect()){
                Object before=Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
                Path preserved=f.root.resolve("synthetic-preserved-capsule-inode"),replacement=f.root.resolve("synthetic-capsule-replacement");
                Files.createLink(preserved,f.committed);Files.copy(f.committed,replacement);
                Files.setPosixFilePermissions(replacement,PosixFilePermissions.fromString("rw-------"));
                Files.move(replacement,f.committed,java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                assertArrayEquals(original,Files.readAllBytes(f.committed));
                assertNotEquals(before,Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertThrows(VaultFailure.class,captured::projection);
                assertArrayEquals(original,Files.readAllBytes(preserved));
            }finally{java.util.Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void capturedCapsuleUnchangedReadbackRetainsClosedSchema()throws Exception {
        try(var f=new Fixture()){
            f.commit();var files=files(f.dir);var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            try(var captured=f.inspect();var first=f.store.inspectExisting();
                var second=NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(f.root.toFile()).inspectExisting()){
                JSONObject before=captured.projection();noAuthority(before);assertTrue(first.sameFixedObservation(second));
                assertEquals(before.toString(),captured.projection().toString());
                JSONObject metadata=first.metadata();assertEquals(18,metadata.length());
                for(String secret:new String[]{"file_key","inode","root_identity","directory_identity","source_identity"})assertFalse(metadata.has(secret));
                first.close();assertThrows(VaultFailure.class,first::metadata);
            }sameFiles(files,f.dir);stable.check();
        }
    }
    @Test public void capturedCapsuleRefusesRootDirectoryAndLockReplacement()throws Exception {
        for(String changed:new String[]{"root","directory","lock"})try(var f=new Fixture()){
            f.commit();var original=files(f.dir);
            try(var captured=f.inspect()){
                Path preserved=changed.equals("root")?f.root.resolveSibling(f.root.getFileName()+"-preserved-root"):
                    f.root.resolve("synthetic-preserved-"+changed);
                if(changed.equals("root")){
                    Files.move(f.root,preserved);Files.createDirectory(f.root,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
                    Files.move(preserved.resolve(NativePrivateCapsuleFileStore.DIRECTORY),f.dir);
                    try{assertThrows(VaultFailure.class,captured::projection);sameFiles(original,f.dir);}
                    finally{Files.move(f.dir,preserved.resolve(NativePrivateCapsuleFileStore.DIRECTORY));Files.delete(f.root);Files.move(preserved,f.root);}
                }else if(changed.equals("directory")){
                    Files.move(f.dir,preserved);Files.createDirectory(f.dir,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
                    for(String name:original.keySet())Files.createLink(f.dir.resolve(name),preserved.resolve(name));
                    try{assertThrows(VaultFailure.class,captured::projection);sameFiles(original,f.dir);sameFiles(original,preserved);}
                    finally{for(String name:original.keySet())Files.delete(f.dir.resolve(name));Files.delete(f.dir);Files.move(preserved,f.dir);}
                }else{
                    Path lock=f.dir.resolve(NativePrivateCapsuleFileStore.LOCK);Files.createLink(preserved,lock);
                    Files.delete(lock);Files.createFile(lock,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
                    try{assertThrows(VaultFailure.class,captured::projection);sameFiles(original,f.dir);assertEquals(0,Files.size(preserved));}
                    finally{Files.delete(lock);Files.createLink(lock,preserved);Files.delete(preserved);}
                }
                // Restoring the genuine source does not thaw a refused held capture.
                assertThrows(VaultFailure.class,captured::projection);sameFiles(original,f.dir);
            }
        }
    }
    @Test public void capturedPendingOwnerChangeAfterForcePreservesOriginal()throws Exception {
        try(var f=new Fixture()){
            byte[] original=originalPendingBeforeForce(f);var before=files(f.dir);Object inode=Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            int[] forces={0};var changed=f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");
            Object normal=capsuleFault(f.store,(operation,delegate,args)->{
                assertEquals("forceFile",operation);forces[0]++;normalCapsuleIo(delegate,operation,args);
                changed.put("identity-force-owner-withdrawal","synthetic source changed after original force");
            });
            try(var captured=f.inspect()){
                noAuthority(captured.projection());assertThrows(VaultFailure.class,()->f.engine().resumeOriginalPrivateCustody(captured));
                assertThrows(VaultFailure.class,captured::projection);assertEquals(1,forces[0]);assertFalse(Files.exists(f.committed));
                assertEquals(inode,Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey());sameFiles(before,f.dir);
                assertArrayEquals(original,Files.readAllBytes(f.pending));
            }finally{restoreCapsuleIo(f.store,normal);changed.remove("identity-force-owner-withdrawal");java.util.Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void retentionControlInitialForceWithdrawalKeepsPending()throws Exception {
        try(var f=new Fixture();var prepared=f.engine().prepareOriginalRetainedNamespacePrivateCapsule(f.h.l)){
            var changed=f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");int[] forces={0};byte[][] original={null};
            Object normal=capsuleFault(f.store,(operation,delegate,args)->{
                assertEquals("forceFile",operation);forces[0]++;assertNull(original[0]);original[0]=Files.readAllBytes(f.pending);
                normalCapsuleIo(delegate,operation,args);changed.put("retention-initial-force-withdrawal","synthetic source withdrawal");
            });
            try{
                assertThrows(VaultFailure.class,()->f.engine().retainOriginalPrivateCustody(prepared,f.store));
                assertThrows(VaultFailure.class,prepared::projection);assertEquals(1,forces[0]);assertNotNull(original[0]);
                assertFalse(Files.exists(f.committed));assertArrayEquals(original[0],Files.readAllBytes(f.pending));
                var saved=files(f.dir);assertThrows(VaultFailure.class,f::inspect);sameFiles(saved,f.dir);
            }finally{restoreCapsuleIo(f.store,normal);changed.remove("retention-initial-force-withdrawal");if(original[0]!=null)java.util.Arrays.fill(original[0],(byte)0);}
        }
    }
    @Test public void retentionControlAliasForceWithdrawalKeepsBothOriginalLinks()throws Exception {
        try(var f=new Fixture()){
            byte[] original=originalPendingBeforeForce(f);Files.createLink(f.committed,f.pending);var saved=files(f.dir);
            Object inode=Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            var changed=f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");int[] forces={0};
            Object normal=capsuleFault(f.store,(operation,delegate,args)->{
                assertEquals("forceFile",operation);forces[0]++;normalCapsuleIo(delegate,operation,args);
                changed.put("retention-alias-force-withdrawal","synthetic source withdrawal");
            });
            try(var captured=f.inspect()){
                noAuthority(captured.projection());assertThrows(VaultFailure.class,()->f.engine().resumeOriginalPrivateCustody(captured));
                assertThrows(VaultFailure.class,captured::projection);assertEquals(1,forces[0]);
                assertTrue(Files.isSameFile(f.committed,f.pending));sameFiles(saved,f.dir);
                assertEquals(inode,Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(original,Files.readAllBytes(f.pending));
            }finally{restoreCapsuleIo(f.store,normal);changed.remove("retention-alias-force-withdrawal");java.util.Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void retentionControlPostLinkWithdrawalKeepsBothOriginalLinks()throws Exception {
        try(var f=new Fixture()){
            byte[] original=originalPendingBeforeForce(f);Object inode=Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
            var changed=f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");var order=new java.util.ArrayList<String>();
            Object normal=capsuleFault(f.store,(operation,delegate,args)->{
                order.add(operation);assertArrayEquals(original,Files.readAllBytes(f.pending));normalCapsuleIo(delegate,operation,args);
                if(operation.equals("linkPending"))changed.put("retention-post-link-withdrawal","synthetic source withdrawal");
            });
            try(var captured=f.inspect()){
                noAuthority(captured.projection());assertThrows(VaultFailure.class,()->f.engine().resumeOriginalPrivateCustody(captured));
                assertThrows(VaultFailure.class,captured::projection);assertEquals(java.util.List.of("forceFile","linkPending"),order);
                assertTrue(Files.isSameFile(f.committed,f.pending));assertEquals(inode,Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(original,Files.readAllBytes(f.pending));assertArrayEquals(original,Files.readAllBytes(f.committed));
            }finally{restoreCapsuleIo(f.store,normal);changed.remove("retention-post-link-withdrawal");java.util.Arrays.fill(original,(byte)0);}
        }
    }
    @Test public void INVOCATION_RETENTION_liveFiniteControlRetainsWithoutAuthority()throws Exception {
        try(var invocation=new NativePrivateCustodyFrameReadControl();var f=new Fixture();
            var prepared=f.engine().prepareOriginalRetainedNamespacePrivateCapsule(f.h.l)){
            var original=prepared.projection();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            try(var result=f.engine().retainOriginalPrivateCustody(prepared,f.store,invocation)){
                noAuthority(result.projection());assertEquals(original.toString(),result.projection().getJSONObject("capsule").toString());
                assertEquals(original.toString(),prepared.projection().toString());invocation.check();
            }
            assertTrue(Files.exists(f.committed));assertFalse(Files.exists(f.pending));stable.check();
        }
    }
    @Test public void INVOCATION_RETENTION_canceledOrNullRefusesBeforeWrite()throws Exception {
        try(var invocation=new NativePrivateCustodyFrameReadControl();var f=new Fixture();
            var prepared=f.engine().prepareOriginalRetainedNamespacePrivateCapsule(f.h.l)){
            var original=prepared.projection();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            assertThrows(VaultFailure.class,()->f.engine().retainOriginalPrivateCustody(prepared,f.store,null));
            assertFalse(Files.exists(f.dir));invocation.cancel();
            assertThrows(VaultFailure.class,()->f.engine().retainOriginalPrivateCustody(prepared,f.store,invocation));
            assertFalse(Files.exists(f.dir));assertEquals(original.toString(),prepared.projection().toString());stable.check();
        }
    }
    @Test public void INVOCATION_RETENTION_initialForceCancelPreservesPending()throws Exception {
        try(var invocation=new NativePrivateCustodyFrameReadControl();var f=new Fixture();
            var prepared=f.engine().prepareOriginalRetainedNamespacePrivateCapsule(f.h.l)){
            var originalMetadata=prepared.projection();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            byte[][] original={null};Object[] inode={null};int[] forces={0};
            Object normal=capsuleFault(f.store,(operation,delegate,args)->{
                assertEquals("forceFile",operation);forces[0]++;original[0]=Files.readAllBytes(f.pending);
                inode[0]=Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
                normalCapsuleIo(delegate,operation,args);invocation.cancel();
            });
            try{
                assertThrows(VaultFailure.class,()->f.engine().retainOriginalPrivateCustody(prepared,f.store,invocation));
                assertThrows(VaultFailure.class,invocation::check);assertEquals(1,forces[0]);assertNotNull(original[0]);
                assertFalse(Files.exists(f.committed));assertArrayEquals(original[0],Files.readAllBytes(f.pending));
                assertEquals(inode[0],Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertEquals(originalMetadata.toString(),prepared.projection().toString());stable.check();
            }finally{restoreCapsuleIo(f.store,normal);if(original[0]!=null)java.util.Arrays.fill(original[0],(byte)0);}
        }
    }
    @Test public void INVOCATION_RETENTION_postLinkCancelPreservesBothOriginalLinks()throws Exception {
        try(var invocation=new NativePrivateCustodyFrameReadControl();var f=new Fixture();
            var prepared=f.engine().prepareOriginalRetainedNamespacePrivateCapsule(f.h.l)){
            var originalMetadata=prepared.projection();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            byte[][] original={null};Object[] inode={null};var order=new java.util.ArrayList<String>();
            Object normal=capsuleFault(f.store,(operation,delegate,args)->{
                order.add(operation);
                if(operation.equals("forceFile")){
                    assertNull(original[0]);original[0]=Files.readAllBytes(f.pending);
                    inode[0]=Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
                }
                normalCapsuleIo(delegate,operation,args);if(operation.equals("linkPending"))invocation.cancel();
            });
            try{
                assertThrows(VaultFailure.class,()->f.engine().retainOriginalPrivateCustody(prepared,f.store,invocation));
                assertThrows(VaultFailure.class,invocation::check);assertEquals(java.util.List.of("forceFile","linkPending"),order);
                assertTrue(Files.isSameFile(f.committed,f.pending));assertEquals(inode[0],Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey());
                assertArrayEquals(original[0],Files.readAllBytes(f.pending));assertArrayEquals(original[0],Files.readAllBytes(f.committed));
                assertEquals(originalMetadata.toString(),prepared.projection().toString());stable.check();
            }finally{restoreCapsuleIo(f.store,normal);if(original[0]!=null)java.util.Arrays.fill(original[0],(byte)0);}
        }
    }
    private interface CapsuleFault {void apply(String operation,Object normal,Object[] args)throws Exception;}
    private static Object capsuleFault(NativePrivateCapsuleFileStore store,CapsuleFault fault)throws Exception {
        var field=NativePrivateCapsuleFileStore.class.getDeclaredField("capsuleIo");field.setAccessible(true);Object normal=field.get(store);
        field.set(store,java.lang.reflect.Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},(proxy,method,args)->{
            if(!method.getName().equals("forceFile")&&!method.getName().equals("linkPending"))throw new AssertionError("fixed capsule I/O only");
            fault.apply(method.getName(),normal,args);return null;}));return normal;
    }
    private static void restoreCapsuleIo(NativePrivateCapsuleFileStore store,Object normal)throws Exception {
        var field=NativePrivateCapsuleFileStore.class.getDeclaredField("capsuleIo");field.setAccessible(true);field.set(store,normal);
    }
    private static void normalCapsuleIo(Object normal,String operation,Object[] args)throws Exception {
        var signature=operation.equals("forceFile")?new Class<?>[]{java.nio.channels.FileChannel.class}:new Class<?>[]{};
        var method=normal.getClass().getDeclaredMethod(operation,signature);method.setAccessible(true);
        try{method.invoke(normal,args);}catch(java.lang.reflect.InvocationTargetException e){throw (Exception)e.getCause();}
    }
    private static byte[] originalPendingBeforeForce(Fixture f)throws Exception {
        var calls=new java.util.concurrent.atomic.AtomicInteger();
        Object normal=capsuleFault(f.store,(operation,target,args)->{assertEquals("forceFile",operation);calls.incrementAndGet();
            assertTrue(Files.exists(f.pending));assertFalse(Files.exists(f.committed));throw new java.io.IOException("synthetic initial capsule force failure");});
        try(var prepared=f.engine().prepareOriginalRetainedNamespacePrivateCapsule(f.h.l)) {
            denied(()->f.engine().retainOriginalPrivateCustody(prepared,f.store));
        }finally{restoreCapsuleIo(f.store,normal);}
        assertEquals(1,calls.get());assertTrue(Files.exists(f.pending));assertFalse(Files.exists(f.committed));return Files.readAllBytes(f.pending);
    }
    private static void sameOriginalCapsule(JSONObject original,JSONObject result)throws Exception {
        noAuthority(result);assertEquals(original.get("original_generation_id"),result.get("original_generation_id"));
        assertEquals(original.getJSONObject("capsule").toString(),result.getJSONObject("capsule").toString());
    }
    @Test public void pendingForceFailureRecoveryForcesSameCapsuleBeforeLink()throws Exception {try(var f=new Fixture()){
        byte[] original=originalPendingBeforeForce(f);var order=new java.util.ArrayList<String>();
        Object inode=Files.readAttributes(f.pending,java.nio.file.attribute.BasicFileAttributes.class).fileKey();
        capsuleFault(f.store,(operation,normal,args)->{order.add(operation);assertTrue(Files.exists(f.pending));assertFalse(Files.exists(f.committed));
            assertArrayEquals(original,Files.readAllBytes(f.pending));if(operation.equals("linkPending"))assertEquals(java.util.List.of("forceFile","linkPending"),order);
            normalCapsuleIo(normal,operation,args);});
        try(var observed=f.inspect()){JSONObject metadata=observed.projection();noAuthority(metadata);
            try(var resumed=f.engine().resumeOriginalPrivateCustody(observed)){sameOriginalCapsule(metadata,resumed.projection());}}
        assertEquals(java.util.List.of("forceFile","linkPending"),order);assertArrayEquals(original,Files.readAllBytes(f.committed));assertFalse(Files.exists(f.pending));
        assertEquals(inode,Files.readAttributes(f.committed,java.nio.file.attribute.BasicFileAttributes.class).fileKey());java.util.Arrays.fill(original,(byte)0);
    }}
    @Test public void sameInodeAliasForcesOriginalBeforeAliasDeletion()throws Exception {try(var f=new Fixture()){
        f.commit();byte[] original=Files.readAllBytes(f.committed);Files.createLink(f.pending,f.committed);var order=new java.util.ArrayList<String>();
        capsuleFault(f.store,(operation,normal,args)->{order.add(operation);assertEquals("forceFile",operation);assertTrue(Files.isSameFile(f.committed,f.pending));
            assertArrayEquals(original,Files.readAllBytes(f.committed));normalCapsuleIo(normal,operation,args);});
        try(var observed=f.inspect()){JSONObject metadata=observed.projection();try(var resumed=f.engine().resumeOriginalPrivateCustody(observed)){sameOriginalCapsule(metadata,resumed.projection());}}
        assertEquals(java.util.List.of("forceFile"),order);assertFalse(Files.exists(f.pending));assertArrayEquals(original,Files.readAllBytes(f.committed));java.util.Arrays.fill(original,(byte)0);
    }}
    @Test public void recoveredCapsuleForceFailuresPreservePendingAndAlias()throws Exception {
        for(boolean alias:new boolean[]{false,true})for(boolean after:new boolean[]{false,true})try(var f=new Fixture()){
            byte[] original=originalPendingBeforeForce(f);if(alias)Files.createLink(f.committed,f.pending);var saved=files(f.dir);var calls=new java.util.concurrent.atomic.AtomicInteger();
            Object normal=capsuleFault(f.store,(operation,target,args)->{assertEquals("forceFile",operation);calls.incrementAndGet();
                if(after)normalCapsuleIo(target,operation,args);throw new java.io.IOException("synthetic recovered capsule force failure");});
            JSONObject metadata;try(var observed=f.inspect()){metadata=observed.projection();denied(()->f.engine().resumeOriginalPrivateCustody(observed));}
            assertEquals(1,calls.get());sameFiles(saved,f.dir);restoreCapsuleIo(f.store,normal);
            try(var observed=f.inspect();var resumed=f.engine().resumeOriginalPrivateCustody(observed)){sameOriginalCapsule(metadata,resumed.projection());}
            assertArrayEquals(original,Files.readAllBytes(f.committed));assertFalse(Files.exists(f.pending));java.util.Arrays.fill(original,(byte)0);
        }
    }
    @Test public void recoveredCapsuleLinkFailuresKeepExactOriginalRecoverable()throws Exception {
        for(boolean after:new boolean[]{false,true})try(var f=new Fixture()){
            byte[] original=originalPendingBeforeForce(f);var order=new java.util.ArrayList<String>();
            Object normal=capsuleFault(f.store,(operation,target,args)->{order.add(operation);
                if(operation.equals("forceFile")){normalCapsuleIo(target,operation,args);return;}
                assertEquals(java.util.List.of("forceFile","linkPending"),order);if(after)normalCapsuleIo(target,operation,args);
                throw new java.io.IOException("synthetic recovered capsule link failure");});
            JSONObject metadata;try(var observed=f.inspect()){metadata=observed.projection();denied(()->f.engine().resumeOriginalPrivateCustody(observed));}
            assertEquals(java.util.List.of("forceFile","linkPending"),order);assertTrue(Files.exists(f.pending));assertEquals(after,Files.exists(f.committed));
            assertArrayEquals(original,Files.readAllBytes(f.pending));if(after){assertTrue(Files.isSameFile(f.committed,f.pending));assertArrayEquals(original,Files.readAllBytes(f.committed));}
            restoreCapsuleIo(f.store,normal);var retry=new java.util.ArrayList<String>();
            capsuleFault(f.store,(operation,target,args)->{retry.add(operation);assertTrue(Files.exists(f.pending));normalCapsuleIo(target,operation,args);});
            try(var observed=f.inspect();var resumed=f.engine().resumeOriginalPrivateCustody(observed)){sameOriginalCapsule(metadata,resumed.projection());}
            assertEquals(after?java.util.List.of("forceFile"):java.util.List.of("forceFile","linkPending"),retry);
            assertArrayEquals(original,Files.readAllBytes(f.committed));assertFalse(Files.exists(f.pending));java.util.Arrays.fill(original,(byte)0);
        }
    }
    @Test public void postForceChangedInodeOrCiphertextRefusesPromotion()throws Exception {
        for(boolean replaceInode:new boolean[]{false,true})try(var f=new Fixture()){
            byte[] original=originalPendingBeforeForce(f);var calls=new java.util.concurrent.atomic.AtomicInteger();
            capsuleFault(f.store,(operation,normal,args)->{assertEquals("forceFile",operation);calls.incrementAndGet();normalCapsuleIo(normal,operation,args);
                if(replaceInode){Files.move(f.pending,f.root.resolve("preserved-original-capsule"));
                    Files.createFile(f.pending,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));Files.write(f.pending,original);}
                else {byte[] changed=original.clone();try {changed[changed.length-33]^=1;
                    var digest=java.security.MessageDigest.getInstance("SHA-256");digest.update(changed,0,changed.length-32);
                    byte[] checksum=digest.digest();try{System.arraycopy(checksum,0,changed,changed.length-32,32);}finally{java.util.Arrays.fill(checksum,(byte)0);}
                    Files.write(f.pending,changed);
                }finally{java.util.Arrays.fill(changed,(byte)0);}}
            });
            try(var observed=f.inspect()){denied(()->f.engine().resumeOriginalPrivateCustody(observed));}
            assertEquals(1,calls.get());assertFalse(Files.exists(f.committed));assertTrue(Files.exists(f.pending));
            if(replaceInode){assertArrayEquals(original,Files.readAllBytes(f.pending));assertArrayEquals(original,Files.readAllBytes(f.root.resolve("preserved-original-capsule")));}
            else assertFalse(java.util.Arrays.equals(original,Files.readAllBytes(f.pending)));java.util.Arrays.fill(original,(byte)0);
        }
    }
    @Test public void closedRecoveredCapsuleAfterForceRefusesPromotion()throws Exception {try(var f=new Fixture()){
        byte[] original=originalPendingBeforeForce(f);var saved=files(f.dir);var calls=new java.util.concurrent.atomic.AtomicInteger();
        try(var observed=f.inspect()){
            var field=observed.getClass().getDeclaredField("capsule");field.setAccessible(true);
            var capsule=(NativeRetainedNamespacePrivateCapsule)field.get(observed);
            capsuleFault(f.store,(operation,normal,args)->{assertEquals("forceFile",operation);calls.incrementAndGet();normalCapsuleIo(normal,operation,args);capsule.close();});
            denied(()->f.engine().resumeOriginalPrivateCustody(observed));
        }
        assertEquals(1,calls.get());sameFiles(saved,f.dir);assertFalse(Files.exists(f.committed));java.util.Arrays.fill(original,(byte)0);
    }}
    static Object testKey(String method,Class<?>[] signature,Object...args)throws Exception {
        var m=AndroidKeystoreCipher.class.getDeclaredMethod(method,signature);m.setAccessible(true);return m.invoke(null,args);
    }
    static final class Handles implements AutoCloseable {
        final NativeRetainedNamespaceCustodyLayoutTest.Fixture x;
        final VaultEngine.NativeRetainedGenerationObservation g;final NativeProtectedNamespaceObservation n;
        final VaultEngine.NativeRetainedNamespaceValueObservation v;final VaultEngine.NativeRetainedNamespaceSemanticObservation s;
        final VaultEngine.NativeRetainedNamespaceCustodyLayoutObservation l;
        Handles(NativeRetainedNamespaceCustodyLayoutTest.Fixture x)throws Exception {
            this.x=x;g=x.f.x.f.generation();n=x.f.x.observe();v=x.f.values(g,n);s=x.f.join(v);l=x.layout(s);
        }
        @Override public void close(){l.close();s.close();v.close();n.close();g.close();}
    }
    static final class Fixture implements AutoCloseable {
        final NativeRetainedNamespaceCustodyLayoutTest.Fixture x;
        final Handles h;final Path root,dir,committed,pending;final NativePrivateCapsuleFileStore store;
        Fixture()throws Exception {this(new NativeRetainedNamespaceCustodyLayoutTest.Fixture());}
        Fixture(NativeRetainedNamespaceCustodyLayoutTest.Fixture original)throws Exception {
            x=java.util.Objects.requireNonNull(original);
            String p=System.getProperty("custodial.custody.fixture.root");if(p==null)throw new AssertionError("owned fixture required");
            root=Files.createTempDirectory(Path.of(p),"owner-case-",PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            dir=root.resolve(NativePrivateCapsuleFileStore.DIRECTORY);committed=dir.resolve(NativePrivateCapsuleFileStore.COMMITTED);pending=dir.resolve(NativePrivateCapsuleFileStore.PENDING);
            store=NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(root.toFile());
            var owner=x.f.x.f.batch.old;char[] credential=owner.vaultCipher.decrypt(owner.persistence.current().secret);
            try{testKey("installSynthetic",new Class<?>[]{EncryptedSecret.class,char[].class},owner.persistence.current().secret,credential);}
            finally{VaultValidation.wipe(credential);}
            if(Boolean.getBoolean("custodial.fixture.original-batch-before-capture")){
                try(var generation=x.f.x.f.generation();var originalBatch=x.f.x.f.prepare(generation)){
                    assertNotNull(x.f.x.f.batch.journal.observe());
                }
            }
            h=new Handles(x);
        }
        VaultEngine engine(){return x.f.engine();}
        VaultEngine.NativePrivateCustodyObservation inspect()throws Exception{return engine().inspectOriginalPrivateCustody(h.l,store);}
        void commit()throws Exception {
            try(var prepared=engine().prepareOriginalRetainedNamespacePrivateCapsule(h.l);var result=engine().retainOriginalPrivateCustody(prepared,store)){noAuthority(result.projection());}
        }
        @Override public void close(){h.close();try{testKey("clearSynthetic",new Class<?>[]{});}catch(Exception e){throw new AssertionError(e);}x.f.x.f.preserved();}
    }
    static void denied(NativeOriginalGenerationObservationTest.Action a)throws Exception{NativeRetainedNamespacePrivateCapsuleTest.denied(a);}
    static void noAuthority(JSONObject p)throws Exception {
        assertEquals(9,p.getInt("source_declared_native_domain_count"));assertEquals(8,p.getJSONArray("original_eight_namespaces").length());
        assertEquals(4,p.getInt("original_key_family_count"));assertEquals(NativeProtectedNamespaceObservation.SHARED_KEY,p.get("additional_file_key_family"));
        assertEquals(p.get("additional_file_key_family"),p.getJSONObject("additional_protected_file_domain").get("key_family"));
        assertEquals(NativePrivateCapsuleFileStore.DIRECTORY,p.getJSONObject("additional_protected_file_domain").get("protected_storage_domain"));
        for(String flag:new String[]{"complete_namespace_inventory","all_writer_durable_freeze_or_ABA_guard","actual_Android_storage_qualified","actual_Android_keystore_qualified",
            "durable_retention","current_server_readback","inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(flag,p.getBoolean(flag));
        assertEquals("UNKNOWN",p.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",p.get("browser_inventory_state"));
        for(String text:new String[]{"synthetic-batch-token-one","body_base64","installation_seal","raw_values","\"ciphertext\""})assertFalse(text,p.toString().contains(text));
    }
    static Map<String,byte[]> files(Path dir)throws Exception {
        Map<String,byte[]> result=new HashMap<>();try(var entries=Files.newDirectoryStream(dir)){for(Path p:entries)result.put(p.getFileName().toString(),Files.readAllBytes(p));}return result;
    }
    static void sameFiles(Map<String,byte[]> expected,Path dir)throws Exception {var actual=files(dir);assertEquals(expected.keySet(),actual.keySet());for(var e:expected.entrySet())assertArrayEquals(e.getValue(),actual.get(e.getKey()));}
    @Test public void absentExtraDomainIsNamedAlongsideOriginalEightButCreatesNothingOrAuthority()throws Exception {
        try(var f=new Fixture()){var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);try(var observed=f.inspect()){
            var p=observed.projection();noAuthority(p);assertSame(JSONObject.NULL,p.get("capsule"));assertFalse(Files.exists(f.dir));denied(()->f.engine().resumeOriginalPrivateCustody(observed));stable.check();}}
    }
    @Test public void sameEngineOriginalCapsuleRetainsThenReopensExactBytesWithOriginalActorsAndNoOldStoreWrites()throws Exception {
        try(var f=new Fixture()){var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);f.commit();var saved=files(f.dir);
            try(var observed=f.inspect()){var p=observed.projection();noAuthority(p);assertEquals(f.h.g.projection().get("generation_id"),p.get("original_generation_id"));
                var digest=p.getJSONObject("capsule").get("capsule_sha256");try(var resumed=f.engine().resumeOriginalPrivateCustody(observed)){
                    assertEquals(digest,resumed.projection().getJSONObject("capsule").get("capsule_sha256"));sameFiles(saved,f.dir);stable.check();}}
        }
    }
    @Test public void originalSavedPendingIsObservedOnlyUntilExplicitCurrentOwnerResumeWithoutFreshIv()throws Exception {
        try(var f=new Fixture()){f.commit();byte[] bytes=Files.readAllBytes(f.committed);Files.move(f.committed,f.pending);var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);
            try(var observed=f.inspect()){assertFalse(Files.exists(f.committed));String digest=observed.projection().getJSONObject("capsule").getString("capsule_sha256");
                try(var resumed=f.engine().resumeOriginalPrivateCustody(observed)){assertEquals(digest,resumed.projection().getJSONObject("capsule").get("capsule_sha256"));assertArrayEquals(bytes,Files.readAllBytes(f.committed));assertFalse(Files.exists(f.pending));}
                denied(observed::projection);stable.check();}
        }
    }
    @Test public void newOpenTypedCaptureOfSameOriginalGenerationReopensWithoutReplacingRecord()throws Exception {
        try(var f=new Fixture()){f.commit();var saved=files(f.dir);f.h.close();try(var fresh=new Handles(f.x);var observed=f.engine().inspectOriginalPrivateCustody(fresh.l,f.store)){
            noAuthority(observed.projection());sameFiles(saved,f.dir);}}
    }
    @Test public void closedForeignAndMissingOriginalHandlesRefuseBeforeStorageCreation()throws Exception {
        try(var f=new Fixture()){
            denied(()->f.engine().inspectOriginalPrivateCustody(null,f.store));denied(()->f.engine().inspectOriginalPrivateCustody(f.h.l,null));
            var other=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();try(var foreign=new Handles(other)){
                denied(()->f.engine().inspectOriginalPrivateCustody(foreign.l,f.store));
            }other.f.x.f.preserved();
            f.h.l.close();denied(f::inspect);assertFalse(Files.exists(f.dir));
        }
    }
    @Test public void foreignPreparedCapsuleOrClosedPreparedHandleCannotWriteAnotherOwnerStore()throws Exception {
        try(var f=new Fixture();var own=f.engine().prepareOriginalRetainedNamespacePrivateCapsule(f.h.l)){
            var other=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();
            denied(()->other.f.engine().retainOriginalPrivateCustody(own,f.store));own.close();denied(()->f.engine().retainOriginalPrivateCustody(own,f.store));assertFalse(Files.exists(f.dir));other.f.x.f.preserved();}
    }
    @Test public void eachChangedOriginalNativeMapInvalidatesHandleAndPreservesExistingCiphertext()throws Exception {
        try(var f=new Fixture()){f.commit();var saved=files(f.dir);try(var observed=f.inspect()){
            var unknown=f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1");unknown.put("unresolved-new-owner-row","synthetic-retained");
            denied(observed::projection);denied(()->f.engine().resumeOriginalPrivateCustody(observed));sameFiles(saved,f.dir);assertEquals("synthetic-retained",unknown.get("unresolved-new-owner-row"));}}
    }
    @Test public void missingOrReplacedSyntheticExistingKeyRejectsAbsentAndExistingStoresNoCreateFallback()throws Exception {
        try(var f=new Fixture()){testKey("selectSyntheticKey",new Class<?>[]{int.class},0);denied(f::inspect);assertFalse(Files.exists(f.dir));}
        try(var f=new Fixture()){f.commit();var saved=files(f.dir);testKey("selectSyntheticKey",new Class<?>[]{int.class},2);denied(f::inspect);sameFiles(saved,f.dir);}
    }
    @Test public void closePrivateObservationDoesNotRemoveDiskOrCloseOriginalLayoutAndValues()throws Exception {
        try(var f=new Fixture()){f.commit();var saved=files(f.dir);var observed=f.inspect();observed.close();observed.close();denied(observed::projection);denied(()->f.engine().resumeOriginalPrivateCustody(observed));
            assertNotNull(f.h.l.projection());assertNotNull(f.h.v.projection());sameFiles(saved,f.dir);}
    }
    @Test public void changedFileOrNewUnknownArtifactRejectsStoredHandleWithoutDeletingEvidence()throws Exception {
        try(var f=new Fixture()){f.commit();try(var observed=f.inspect()){
            Files.write(f.committed,new byte[]{3},StandardOpenOption.APPEND);var saved=files(f.dir);denied(observed::projection);denied(()->f.engine().resumeOriginalPrivateCustody(observed));sameFiles(saved,f.dir);}}
        try(var f=new Fixture()){f.commit();try(var observed=f.inspect()){
            Files.write(f.dir.resolve("unresolved-owner-file"),new byte[]{9},StandardOpenOption.CREATE_NEW);var saved=files(f.dir);denied(observed::projection);sameFiles(saved,f.dir);}}
    }
    @Test public void ownerChangeAfterFileEffectRetainsRecordButCannotReturnAcceptanceOrRemoveOriginals()throws Exception {
        try(var f=new Fixture();var prepared=f.engine().prepareOriginalRetainedNamespacePrivateCapsule(f.h.l)){
            Runnable mutate=()->f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("late-owned-unknown","preserved");
            testKey("afterSyntheticChecks",new Class<?>[]{int.class,Runnable.class},3,mutate);
            denied(()->f.engine().retainOriginalPrivateCustody(prepared,f.store));assertTrue(Files.exists(f.committed));assertFalse(Files.exists(f.pending));
            var saved=files(f.dir);denied(f::inspect);sameFiles(saved,f.dir);assertEquals("preserved",f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").get("late-owned-unknown"));}
    }
    @Test public void sameInodeCrashAliasOnlyResumesExactRecoveredOriginalAndChangedAbsenceStaysNonAuthoritative()throws Exception {
        try(var f=new Fixture()){f.commit();byte[] bytes=Files.readAllBytes(f.committed);Files.createLink(f.pending,f.committed);
            try(var observed=f.inspect();var resumed=f.engine().resumeOriginalPrivateCustody(observed)){noAuthority(resumed.projection());assertArrayEquals(bytes,Files.readAllBytes(f.committed));assertFalse(Files.exists(f.pending));}}
        try(var f=new Fixture();var absent=f.inspect()){f.commit();denied(absent::projection);assertTrue(Files.exists(f.committed));}
    }
}
