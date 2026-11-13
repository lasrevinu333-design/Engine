package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.Test;

/** Newly affected finite-bootstrap HOST cases only. Uses the existing semantic
 * source fixture and real Engine token factory, never a constructor/token stub,
 * fake Context or durable-counter seed. Normal host fsync is NOT Android
 * power-loss, platform lifetime, manager authentication or effect authority. */
public final class NativeProtectedInitialBaselineLifetimeTest {
    public static void main(String[] args)throws Exception {
        if(args.length!=2||!args[0].equals("--protected-initial-baseline-lifetime-only")
            ||!Set.of("BASELINE_LIFETIME_liveInvocationKeepsExactBaseline",
                "BASELINE_LIFETIME_nullClosedCanceledOrInterruptedRefusesBeforeEffects",
                "BASELINE_LIFETIME_cancelDuringWriteKeepsPartialWithoutLaterForce",
                "BASELINE_LIFETIME_cancelDuringFileForceStopsLaterArtifacts",
                "BASELINE_LIFETIME_cancelDuringDirectoryForceStopsLockCreation",
                "BASELINE_LIFETIME_cancelDuringMarkerRemovalStopsFollowupForces").contains(args[1]))throw new AssertionError("affected baseline lifetime member required");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeProtectedInitialBaselineLifetimeTest.class,args[1]));
        if(result.getRunCount()!=1||!result.wasSuccessful()){
            for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
        }
        System.out.println("PASS_SOURCE_HOST_BASELINE_LIFETIME "+args[1]);
    }
    private static final class Fixture implements AutoCloseable {
        final NativeRetainedNamespaceSemanticJoinTest.Fixture source=new NativeRetainedNamespaceSemanticJoinTest.Fixture();
        final VaultEngine engine=source.engine();
        final VaultEngine.NativeRetainedGenerationObservation generation=source.x.f.generation();
        final NativeProtectedNamespaceObservation namespaces=source.x.observe();
        final VaultEngine.NativeRetainedNamespaceValueObservation values=source.values(generation,namespaces);
        final VaultEngine.NativeOriginalMutationEpochBootstrap token=engine.prepareOriginalMutationEpochBootstrap(values);
        final Path root,dir;
        Fixture()throws Exception {
            String parent=System.getProperty("custodial.custody.fixture.root");if(parent==null)throw new AssertionError("owned fixture required");
            root=Files.createTempDirectory(Path.of(parent),"finite-baseline-",PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            dir=root.resolve(NativePrivateMutationEpochStore.DIRECTORY);
        }
        NativePrivateMutationEpochStore bootstrap(NativePrivateCustodyFrameReadControl invocation)throws Exception {
            synchronized(engine){return NativePrivateMutationEpochStore.bootstrapFromNativeNoBackupRoot(root.toFile(),token,invocation);}
        }
        @Override public void close(){token.close();values.close();namespaces.close();generation.close();source.x.f.preserved();}
    }
    private interface Fault {Object apply(java.lang.reflect.Method method,Object normal,Object[] args)throws Exception;}
    private static Object fault(Fault action)throws Exception {
        var field=NativePrivateMutationEpochStore.class.getDeclaredField("bootstrapIo");field.setAccessible(true);Object normal=field.get(null);
        field.set(null,java.lang.reflect.Proxy.newProxyInstance(field.getType().getClassLoader(),new Class<?>[]{field.getType()},
            (proxy,method,args)->action.apply(method,normal,args)));return normal;
    }
    private static Object normal(java.lang.reflect.Method method,Object delegate,Object[] args)throws Exception {
        method.setAccessible(true);try{return method.invoke(delegate,args);}
        catch(java.lang.reflect.InvocationTargetException failed){throw (Exception)failed.getCause();}
    }
    private static void restore(Object normal)throws Exception {
        var field=NativePrivateMutationEpochStore.class.getDeclaredField("bootstrapIo");field.setAccessible(true);field.set(null,normal);
    }
    private static final class Kept implements AutoCloseable {
        final Object directoryKey;final Map<String,byte[]> bytes=new HashMap<>();final Map<String,Object> keys=new HashMap<>();
        Kept(Path directory)throws Exception {
            directoryKey=Files.readAttributes(directory,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey();
            try(var files=Files.newDirectoryStream(directory)){for(Path path:files){
                String name=path.getFileName().toString();bytes.put(name,Files.readAllBytes(path));
                keys.put(name,Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey());
            }}
        }
        void same(Path directory)throws Exception {
            assertEquals(directoryKey,Files.readAttributes(directory,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey());
            var names=new java.util.HashSet<String>();try(var files=Files.newDirectoryStream(directory)){for(Path path:files){
                String name=path.getFileName().toString();names.add(name);assertTrue(bytes.containsKey(name));
                assertArrayEquals(bytes.get(name),Files.readAllBytes(path));
                assertEquals(keys.get(name),Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey());
            }}assertEquals(bytes.keySet(),names);
        }
        @Override public void close(){for(byte[] value:bytes.values())Arrays.fill(value,(byte)0);}
    }
    @Test public void BASELINE_LIFETIME_liveInvocationKeepsExactBaseline()throws Exception {
        try(var invocation=new NativePrivateCustodyFrameReadControl();var x=new Fixture()){
            var store=x.bootstrap(invocation);invocation.check();
            try(var current=store.readCurrent()){assertEquals(0,current.counter());store.requireCurrent(current);}
            try(var kept=new Kept(x.dir)){
                assertEquals(Set.of(NativePrivateMutationEpochStore.LOCK,NativePrivateMutationEpochStore.BASELINE,NativePrivateMutationEpochStore.CURRENT),kept.bytes.keySet());
                var initial=ByteBuffer.wrap(kept.bytes.get(NativePrivateMutationEpochStore.CURRENT));
                assertEquals(NativePrivateMutationEpochStore.MAGIC,initial.getInt());assertEquals(1,initial.getInt());
                assertEquals(-1,initial.getLong());assertEquals(0,initial.getLong());
                invocation.close();assertThrows(VaultFailure.class,()->x.bootstrap(invocation));kept.same(x.dir);
            }
        }
    }
    @Test public void BASELINE_LIFETIME_nullClosedCanceledOrInterruptedRefusesBeforeEffects()throws Exception {
        for(String kind:new String[]{"null","closed","canceled","interrupted"})try(var invocation=new NativePrivateCustodyFrameReadControl();var x=new Fixture()){
            try{
                if(kind.equals("closed"))invocation.close();if(kind.equals("canceled"))invocation.cancel();
                if(kind.equals("interrupted"))Thread.currentThread().interrupt();
                assertThrows(VaultFailure.class,()->x.bootstrap(kind.equals("null")?null:invocation));assertFalse(Files.exists(x.dir));
                assertThrows(VaultFailure.class,()->NativePrivateMutationEpochStore.bootstrapFromContext(null,x.token,invocation));
                assertFalse(Files.exists(x.dir));
            }finally{if(kind.equals("interrupted"))Thread.interrupted();}
        }
    }
    @Test public void BASELINE_LIFETIME_cancelDuringWriteKeepsPartialWithoutLaterForce()throws Exception {
        canceledAt("write");
    }
    @Test public void BASELINE_LIFETIME_cancelDuringFileForceStopsLaterArtifacts()throws Exception {
        canceledAt("forceFile");
    }
    @Test public void BASELINE_LIFETIME_cancelDuringDirectoryForceStopsLockCreation()throws Exception {
        canceledAt("forceDirectory");
    }
    @Test public void BASELINE_LIFETIME_cancelDuringMarkerRemovalStopsFollowupForces()throws Exception {
        canceledAt("removeMarker");
    }
    private static void canceledAt(String target)throws Exception {
        try(var invocation=new NativePrivateCustodyFrameReadControl();var x=new Fixture()){
            var events=new ArrayList<String>();var atCancel=new ArrayList<String>();Kept[] kept={null};
            Object original=fault((method,delegate,args)->{
                events.add(method.getName());boolean cancel=kept[0]==null&&method.getName().equals(target);Object result;
                if(cancel&&target.equals("write")){
                    // Real partial host write through the established fixed I/O
                    // seam, not a manufactured successful count or new writer.
                    ByteBuffer bytes=(ByteBuffer)args[1];int limit=bytes.limit();bytes.limit(bytes.position()+Math.min(9,bytes.remaining()));
                    try{result=normal(method,delegate,args);}finally{bytes.limit(limit);}
                }else result=normal(method,delegate,args);
                if(cancel){kept[0]=new Kept(x.dir);atCancel.addAll(events);invocation.cancel();}
                return result;
            });
            try{
                assertThrows(VaultFailure.class,()->x.bootstrap(invocation));assertNotNull(kept[0]);
                assertThrows(VaultFailure.class,invocation::check);assertEquals(atCancel,events);kept[0].same(x.dir);
                if(target.equals("write")){
                    assertEquals(9,Files.size(x.dir.resolve(NativePrivateMutationEpochStore.BASELINE)));
                    assertFalse(Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT)));
                    assertFalse(Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.BOOTSTRAP)));
                }else if(target.equals("forceFile"))assertEquals(Set.of(NativePrivateMutationEpochStore.LOCK),kept[0].bytes.keySet());
                else if(target.equals("forceDirectory"))assertTrue(kept[0].bytes.isEmpty());
                else assertEquals(Set.of(NativePrivateMutationEpochStore.LOCK,NativePrivateMutationEpochStore.BASELINE,NativePrivateMutationEpochStore.CURRENT),kept[0].bytes.keySet());
            }finally{restore(original);if(kept[0]!=null)kept[0].close();}
        }
    }
}
