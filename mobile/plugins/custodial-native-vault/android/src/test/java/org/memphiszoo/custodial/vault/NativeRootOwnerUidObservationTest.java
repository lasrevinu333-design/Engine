package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import org.junit.Test;
import java.lang.reflect.InvocationTargetException;
import java.nio.file.*;
import java.nio.file.attribute.UserPrincipal;

/** Actual local filesystem observations; reflection reaches private DATA
 * adapters only, never creates native admission/authority or a root owner. */
public final class NativeRootOwnerUidObservationTest {
    private static Object invoke(String name,Class<?>[] types,Object... args)throws Exception {
        var method=NativePrivateMutationEpochStore.class.getDeclaredMethod(name,types);method.setAccessible(true);
        try{return method.invoke(null,args);}catch(InvocationTargetException failure){
            var cause=failure.getCause();if(cause instanceof Exception)throw (Exception)cause;throw (Error)cause;
        }
    }
    private static long uid(Path path)throws Exception {
        return ((Number)Files.getAttribute(path,"unix:uid",LinkOption.NOFOLLOW_LINKS)).longValue();
    }
    private static boolean same(Path path,UserPrincipal owner,Long originalUid)throws Exception {
        return (Boolean)invoke("sameOriginalOwner",new Class<?>[]{Path.class,UserPrincipal.class,Long.class},path,owner,originalUid);
    }
    @Test public void richOriginalOwnerBindsSameActualStatAndKeepsFreshReads()throws Exception {
        Path path=Files.createTempDirectory("custodial-owner-data-");
        try{
            var original=invoke("readOriginalOwner",new Class<?>[]{Path.class},path);
            var ownerField=original.getClass().getDeclaredField("owner");ownerField.setAccessible(true);
            var uidField=original.getClass().getDeclaredField("uid");uidField.setAccessible(true);
            var owner=(UserPrincipal)ownerField.get(original);var originalUid=(Long)uidField.get(original);
            assertNotNull(originalUid);assertEquals(uid(path),originalUid.longValue());
            assertEquals(Files.getOwner(path,LinkOption.NOFOLLOW_LINKS),owner);assertTrue(same(path,owner,originalUid));
            assertFalse(same(path,owner,originalUid==0?1L:originalUid-1));
            Files.delete(path);
            assertThrows(NoSuchFileException.class,()->same(path,owner,originalUid));
        }finally{Files.deleteIfExists(path);}
    }
    @Test public void existingRootStillRejectsReplacementAndFinalSymlink()throws Exception {
        Path parent=Files.createTempDirectory("custodial-root-data-"),root=Files.createDirectory(parent.resolve("root"));
        Path old=parent.resolve("original");
        try{
            var original=NativePrivateMutationEpochStore.observeExistingRoot(root.toFile());original.require(root.toFile());
            Files.move(root,old);Files.createDirectory(root);
            assertThrows(VaultFailure.class,()->original.require(root.toFile()));
            Files.delete(root);Files.createSymbolicLink(root,old);
            assertThrows(VaultFailure.class,()->original.require(root.toFile()));
            Files.delete(root);Files.move(old,root);original.require(root.toFile());
        }finally{Files.deleteIfExists(root);Files.deleteIfExists(old);Files.deleteIfExists(parent);}
    }
    @Test public void unsupportedPrincipalUsesActualOriginalComparatorIncludingThrow()throws Exception {
        Path path=Files.createTempDirectory("custodial-owner-fallback-");
        try{
            var actual=Files.getOwner(path,LinkOption.NOFOLLOW_LINKS);boolean[] called={false};
            UserPrincipal unsupported=new UserPrincipal(){public String getName(){return "untrusted-test-DATA";}
                @Override public boolean equals(Object value){called[0]=true;return actual.equals(value);}
                @Override public int hashCode(){return 1;}};
            assertTrue(same(path,unsupported,uid(path)+1));assertTrue(called[0]);
            assertFalse(same(path,actual,uid(path)+1));
            UserPrincipal refusing=new UserPrincipal(){public String getName(){return "untrusted-test-DATA";}
                @Override public boolean equals(Object value){throw new SecurityException("fixed DATA refusal");}
                @Override public int hashCode(){return 1;}};
            assertThrows(SecurityException.class,()->same(path,refusing,uid(path)));
            Files.delete(path);assertThrows(NoSuchFileException.class,()->same(path,unsupported,null));
        }finally{Files.deleteIfExists(path);}
    }
}
