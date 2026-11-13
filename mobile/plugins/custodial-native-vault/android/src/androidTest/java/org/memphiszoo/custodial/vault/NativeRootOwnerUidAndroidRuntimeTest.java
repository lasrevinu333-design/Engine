package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.Context;
import android.os.Build;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.nio.file.attribute.UserPrincipal;
import java.util.Locale;
import java.util.UUID;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Actual Android file-provider/Context DATA checks only. No Engine, enrollment,
 * preferences, journal, key, Source, network, manager, ACK or finalizer access.
 * Root itself is observed only. Mutations stay inside a newly created UUID
 * child; its test-owned evidence remains for the disposable target's owner. */
@RunWith(AndroidJUnit4.class)
public final class NativeRootOwnerUidAndroidRuntimeTest {
    private static Context isolatedApplication() {
        var context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("isolated normal instrumentation target only",context.getPackageName().endsWith(".test"));
        assertTrue("managed emulator only; no phone action",Build.FINGERPRINT.contains("generic")
            ||(Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE)));
        var application=context.getApplicationContext();assertNotNull(application);
        assertSame(application,application.getApplicationContext());
        assertEquals(context.getPackageName(),application.getPackageName());return application;
    }
    private static Object key(Path path)throws Exception {
        var attributes=Files.readAttributes(path,"unix:uid,mode,fileKey",LinkOption.NOFOLLOW_LINKS);
        assertEquals(android.os.Process.myUid(),((Number)attributes.get("uid")).intValue());
        assertEquals(0040000,((Number)attributes.get("mode")).intValue()&0170000);
        assertNotNull(attributes.get("fileKey"));return attributes.get("fileKey");
    }
    @Test public void actualContextAndRichUnixOwnerStayBound()throws Exception {
        var app=isolatedApplication();var root=NativePrivateMutationEpochStore.originalContextNoBackupRoot(app);
        var contextRoot=NativePrivateMutationEpochStore.observeOriginalContextRoot(app);contextRoot.requireCurrent();
        var path=root.toPath();Object originalKey=key(path);
        // Both requested fields come from the actual platform's one unix stat.
        var rich=Files.readAttributes(path,"unix:owner,uid",LinkOption.NOFOLLOW_LINKS);
        assertTrue(rich.get("owner") instanceof UserPrincipal);var owner=(UserPrincipal)rich.get("owner");
        assertEquals(android.os.Process.myUid(),((Number)rich.get("uid")).intValue());
        assertSame(Object.class.getClassLoader(),Files.class.getClassLoader());
        assertSame(Object.class.getClassLoader(),owner.getClass().getClassLoader());
        assertSame(Object.class.getClassLoader(),path.getFileSystem().provider().getClass().getClassLoader());
        assertEquals("file",path.getFileSystem().provider().getScheme());
        assertEquals(owner,Files.getOwner(path,LinkOption.NOFOLLOW_LINKS));
        // Exercises the actual production rich owner binding and fresh UID
        // comparisons; no reflected capability or manufactured principal.
        var existing=NativePrivateMutationEpochStore.observeExistingRoot(root);
        existing.require(root);contextRoot.requireCurrent();existing.require(root);
        assertEquals(originalKey,key(path));
        assertEquals(root,NativePrivateMutationEpochStore.originalContextNoBackupRoot(app));
        System.out.println("UNIT_ANDROID_ROOT_OWNER_UID_PLATFORM; actual Context/unix DATA only; no authority or timing qualification");
    }
    @Test public void freshOwnedChildReplacementAndSymlinkAreRefused()throws Exception {
        var app=isolatedApplication();var root=NativePrivateMutationEpochStore.originalContextNoBackupRoot(app).toPath();
        var contextRoot=NativePrivateMutationEpochStore.observeOriginalContextRoot(app);Object rootKey=key(root);
        var owned=Files.createDirectory(root.resolve("custodial-root-owner-test-"+UUID.randomUUID()),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        var original=Files.createDirectory(owned.resolve("original"),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        Object originalKey=key(original);var retained=NativePrivateMutationEpochStore.observeExistingRoot(original.toFile());
        retained.require(original.toFile());
        var predecessor=owned.resolve("predecessor");Files.move(original,predecessor);
        Files.createDirectory(original,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        Object replacementKey=key(original);assertNotEquals(originalKey,replacementKey);
        assertThrows(VaultFailure.class,()->retained.require(original.toFile()));
        // Delete only the exact empty replacement created immediately above.
        assertEquals(replacementKey,key(original));try(var children=Files.newDirectoryStream(original)){assertFalse(children.iterator().hasNext());}
        Files.delete(original);Files.createSymbolicLink(original,predecessor);
        assertTrue(Files.isSymbolicLink(original));
        assertThrows(VaultFailure.class,()->retained.require(original.toFile()));
        assertEquals(originalKey,key(predecessor));assertEquals(rootKey,key(root));contextRoot.requireCurrent();
        assertEquals(root,NativePrivateMutationEpochStore.originalContextNoBackupRoot(app).toPath());
        System.out.println("UNIT_ANDROID_ROOT_OWNER_UID_FRESH_REFUSALS; new UUID child only; original inode and test symlink retained");
    }
    /** Invokes only private filesystem DATA helpers, never an authority. */
    private static Object uidData(String method,Path path)throws Exception {
        var helper=NativePrivateMutationEpochStore.class.getDeclaredMethod(method,Path.class);helper.setAccessible(true);
        try{return helper.invoke(null,path);}catch(java.lang.reflect.InvocationTargetException wrapped){
            var cause=wrapped.getCause();if(cause instanceof Exception)throw(Exception)cause;
            if(cause instanceof Error)throw(Error)cause;throw new AssertionError(cause);
        }
    }
    @Test public void actualPublicOsUidIsFreshNoFollowAndDoesNotFallbackAfterErrno()throws Exception {
        var app=isolatedApplication();var root=NativePrivateMutationEpochStore.originalContextNoBackupRoot(app).toPath();
        var contextRoot=NativePrivateMutationEpochStore.observeOriginalContextRoot(app);Object rootKey=key(root);
        assertSame(Object.class.getClassLoader(),android.system.Os.class.getClassLoader());
        assertSame(Object.class.getClassLoader(),root.getClass().getClassLoader());
        assertEquals(Boolean.TRUE,uidData("publicAndroidUidPath",root));
        assertEquals((long)android.system.Os.lstat(root.toString()).st_uid,uidData("uid",root));
        assertEquals(((Number)Files.getAttribute(root,"unix:uid",LinkOption.NOFOLLOW_LINKS)).longValue(),uidData("uid",root));
        var owned=Files.createDirectory(root.resolve("custodial-public-uid-test-"+UUID.randomUUID()),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        var original=Files.createFile(owned.resolve("original"));
        assertEquals((long)android.os.Process.myUid(),uidData("uid",original));
        Files.move(original,owned.resolve("retained-original"));
        var absent=assertThrows(android.system.ErrnoException.class,()->uidData("uid",original));
        assertEquals(android.system.OsConstants.ENOENT,absent.errno);
        // A self-referential symlink distinguishes lstat from following stat:
        // the latter refuses ELOOP; the production UID read observes the link.
        var loop=Files.createSymbolicLink(owned.resolve("loop"),Path.of("loop"));
        assertTrue(Files.isSymbolicLink(loop));
        assertEquals((long)android.os.Process.myUid(),uidData("uid",loop));
        var denied=Files.createDirectory(owned.resolve("denied"),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        var child=Files.createFile(denied.resolve("child"));Object deniedKey=key(denied);
        try{
            Files.setPosixFilePermissions(denied,java.util.Collections.emptySet());
            var refusal=assertThrows(android.system.ErrnoException.class,()->uidData("uid",child));
            assertEquals(android.system.OsConstants.EACCES,refusal.errno);
        }finally{
            assertEquals(deniedKey,key(denied));Files.setPosixFilePermissions(denied,PosixFilePermissions.fromString("rwx------"));
        }
        var wrapper=(Path)java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{Path.class},
            (proxy,method,args)->method.invoke(root,args));
        assertEquals(Boolean.FALSE,uidData("publicAndroidUidPath",wrapper));
        assertThrows(ProviderMismatchException.class,()->uidData("uid",wrapper));
        assertEquals(rootKey,key(root));contextRoot.requireCurrent();
        System.out.println("UNIT_ANDROID_PUBLIC_UID_STAT_DATA; actual NOFOLLOW/ENOENT/EACCES/custom-path refusals only; no timing or authority qualification");
    }
}
