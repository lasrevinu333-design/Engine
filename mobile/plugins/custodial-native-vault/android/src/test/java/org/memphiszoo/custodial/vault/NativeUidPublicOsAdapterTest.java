package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.lang.reflect.*;
import java.nio.file.*;
import org.junit.Test;

/** Host DATA-only fallback/refusal checks. Reflection reaches private stat and
 * representation helpers, never Engine authorities or capability constructors. */
public final class NativeUidPublicOsAdapterTest {
    private static Object call(String name,Class<?> type,Object argument)throws Exception {
        var method=NativePrivateMutationEpochStore.class.getDeclaredMethod(name,type);method.setAccessible(true);
        try{return method.invoke(null,argument);}catch(InvocationTargetException wrapped){
            var cause=wrapped.getCause();if(cause instanceof Exception)throw(Exception)cause;
            if(cause instanceof Error)throw(Error)cause;throw new AssertionError(cause);
        }
    }
    private static boolean selected(Path p)throws Exception{return(Boolean)call("publicAndroidUidPath",Path.class,p);}
    private static long uid(Path p)throws Exception{return(Long)call("uid",Path.class,p);}
    @Test public void unsupportedHostKeepsFreshProviderReadAndMissingRefusal()throws Exception {
        var directory=Files.createTempDirectory("custodial-uid-host-");var file=Files.createFile(directory.resolve("original"));
        assertFalse("host android.jar is not bootstrap Android API",selected(file));
        assertEquals(((Number)Files.getAttribute(file,"unix:uid",LinkOption.NOFOLLOW_LINKS)).longValue(),uid(file));
        Files.move(file,directory.resolve("retained-original"));
        assertThrows(NoSuchFileException.class,()->uid(file));
        assertFalse(selected(Path.of("relative-owned-data-only")));
    }
    @Test public void wrapperAdvertisingCoreFilesystemCannotBypassProviderRefusal()throws Exception {
        var real=Files.createTempDirectory("custodial-uid-wrapper-");
        var wrapper=(Path)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{Path.class},
            (proxy,method,args)->method.invoke(real,args));
        assertEquals(real.getFileSystem(),wrapper.getFileSystem());assertEquals(real.toString(),wrapper.toString());
        assertFalse(selected(wrapper));
        assertThrows(ProviderMismatchException.class,()->uid(wrapper));
    }
    @Test public void signedUidRepresentationNeverBecomesUnsignedAdmission()throws Exception {
        for(Object value:new Object[]{Integer.MIN_VALUE,Integer.valueOf(-1),Long.valueOf(-1),Long.valueOf(0x1_0000_0000L),Double.valueOf(0),"0"})
            assertThrows(VaultFailure.class,()->call("uidValue",Object.class,value));
        assertEquals(Long.valueOf(0),call("uidValue",Object.class,Integer.valueOf(0)));
        assertEquals(Long.valueOf(Integer.MAX_VALUE),call("uidValue",Object.class,Integer.valueOf(Integer.MAX_VALUE)));
        assertEquals(Long.valueOf(0xffff_ffffL),call("uidValue",Object.class,Long.valueOf(0xffff_ffffL)));
    }
}
