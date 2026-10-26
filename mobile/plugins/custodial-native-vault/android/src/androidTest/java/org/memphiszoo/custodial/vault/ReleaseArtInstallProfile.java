package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.os.SystemClock;
import android.system.Os;
import android.system.OsConstants;
import android.system.StructPollfd;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.regex.Pattern;
import org.json.JSONObject;
import static org.junit.Assert.*;

/** Only a generated disposable release profile can select this metadata read.
 * No compilation, permission adoption, package mutation or original is made. */
final class ReleaseArtInstallProfile {
    private static final String PACKAGE="org.memphiszoo.custodial.vault.test";
    private static final String COMMAND="pm art dump "+PACKAGE;
    private static final int LIMIT=131_072;

    static boolean selected() throws Exception {
        final Class<?> type;
        final java.lang.reflect.Field field;
        try {
            type=Class.forName(PACKAGE+".BuildConfig",false,ReleaseArtInstallProfile.class.getClassLoader());
            field=type.getField("CUSTODIAL_RELEASE_ART_SPEED");
        } catch (ClassNotFoundException|NoSuchFieldException absent) { return false; }
        assertSame(ReleaseArtInstallProfile.class.getClassLoader(),type.getClassLoader());
        assertEquals(boolean.class,field.getType());
        int flags=field.getModifiers();
        assertTrue(java.lang.reflect.Modifier.isPublic(flags)&&java.lang.reflect.Modifier.isStatic(flags)
            &&java.lang.reflect.Modifier.isFinal(flags));
        return field.getBoolean(null);
    }

    static void requireIfSelected(Context target) throws Exception {
        if(!selected())return;
        // Caller already completed the unchanged exact nondebuggable test signer,
        // runner, fresh-data, emulator, exclusive UID and absent-key guards.
        var instrumentation=InstrumentationRegistry.getInstrumentation();
        assertEquals(PACKAGE,target.getPackageName());
        assertEquals(PACKAGE,instrumentation.getContext().getPackageName());
        var manager=target.getPackageManager();
        ApplicationInfo original=manager.getApplicationInfo(PACKAGE,0);
        assertEquals(Process.myUid(),original.uid);
        assertEquals(0,original.flags&ApplicationInfo.FLAG_DEBUGGABLE);
        assertTrue(Process.is64Bit());
        assertTrue(Arrays.asList(android.os.Build.SUPPORTED_ABIS).contains("x86_64"));
        assertTrue("ART_PROFILE_REFUSED: unexpected split APKs",original.splitSourceDirs==null||original.splitSourceDirs.length==0);
        Path apk=Path.of(original.sourceDir);
        assertTrue(apk.isAbsolute());assertFalse(Files.isSymbolicLink(apk));
        assertEquals(apk,apk.toRealPath());
        BasicFileAttributes before=Files.readAttributes(apk,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        assertTrue(before.isRegularFile());assertNotNull(before.fileKey());
        assertTrue(before.size()>0&&before.size()<=256L*1024*1024);
        byte[] digest=hash(apk);
        String dump=readDump();
        requireDump(dump,apk.toString());
        ApplicationInfo terminal=manager.getApplicationInfo(PACKAGE,0);
        assertEquals(original.uid,terminal.uid);assertEquals(original.sourceDir,terminal.sourceDir);
        assertEquals(original.flags,terminal.flags);
        assertTrue(terminal.splitSourceDirs==null||terminal.splitSourceDirs.length==0);
        BasicFileAttributes after=Files.readAttributes(apk,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        assertFalse(Files.isSymbolicLink(apk));assertEquals(apk,apk.toRealPath());
        assertEquals(before.fileKey(),after.fileKey());assertEquals(before.size(),after.size());
        assertEquals(before.lastModifiedTime(),after.lastModifiedTime());
        assertArrayEquals(digest,hash(apk));
        JSONObject result=new JSONObject();
        result.put("schema","custodial.disposable-release-art-install-readback.v1");
        result.put("package",PACKAGE);result.put("uid",original.uid);result.put("base_apk",apk.toString());
        result.put("apk_sha256",hex(digest));result.put("dump_sha256",hex(MessageDigest.getInstance("SHA-256").digest(dump.getBytes(StandardCharsets.UTF_8))));
        result.put("actual_art_dump",dump);result.put("isa","x86_64");result.put("filter","speed");result.put("reason","install");
        result.put("before_original_capture",true);result.put("per_method_or_speed_claim",false);
        // Metadata only, before any registration, authority or original exists.
        System.out.println("CUSTODIAL_RELEASE_ART_INSTALL "+result);
    }

    private static String readDump() throws Exception {
        long deadline=SystemClock.elapsedRealtime()+10_000;
        try(ParcelFileDescriptor descriptor=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(COMMAND)) {
            assertNotNull("ART_PROFILE_REFUSED: shell read unavailable",descriptor);
            StructPollfd poll=new StructPollfd();poll.fd=descriptor.getFileDescriptor();
            poll.events=(short)(OsConstants.POLLIN|OsConstants.POLLHUP);
            ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] bytes=new byte[4096];
            for(;;) {
                long remaining=deadline-SystemClock.elapsedRealtime();
                assertTrue("ART_PROFILE_REFUSED: metadata read timeout",remaining>0);
                int count=Os.poll(new StructPollfd[]{poll},(int)Math.min(remaining,1000));
                if(count==0)continue;
                assertEquals("ART_PROFILE_REFUSED: metadata pipe error",0,poll.revents&(OsConstants.POLLERR|OsConstants.POLLNVAL));
                int n=Os.read(poll.fd,bytes,0,bytes.length);
                if(n==0)break;
                assertTrue("ART_PROFILE_REFUSED: metadata bound exceeded",out.size()+n<=LIMIT);
                out.write(bytes,0,n);
            }
            return StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(out.toByteArray())).toString();
        }
    }

    static void requireDump(String dump,String apk) {
        assertNotNull(dump);assertTrue(dump.length()>0&&dump.length()<=LIMIT);
        assertTrue(apk.startsWith("/data/app/")&&apk.endsWith("/base.apk")&&!apk.contains("\n")&&!apk.contains("\r"));
        String[] lines=dump.split("\\n",-1);int packages=0,paths=0,statuses=0;boolean current=false;
        Pattern status=Pattern.compile("x86_64: \\[status=speed\\] \\[reason=install\\] \\[primary-abi\\]");
        for(String raw:lines) {
            String line=raw.strip();
            if(line.matches("\\[[A-Za-z0-9_.]+\\]")) {
                assertEquals("ART_PROFILE_REFUSED: wrong package", "["+PACKAGE+"]",line);
                assertEquals(0,packages++);continue;
            }
            if(line.startsWith("path: ")) {
                assertEquals("ART_PROFILE_REFUSED: wrong APK path",apk,line.substring(6));
                assertEquals(0,paths++);current=true;continue;
            }
            if(line.matches("[A-Za-z0-9_]+: \\[status=.*")) {
                assertTrue("ART_PROFILE_REFUSED: status outside exact APK",current&&packages==1);
                assertTrue("ART_PROFILE_REFUSED: exact speed/install/primary ABI required",status.matcher(line).matches());
                assertEquals(0,statuses++);continue;
            }
            assertFalse("ART_PROFILE_REFUSED: secondary dex scope",line.equals("known secondary dex files:"));
            // The pinned primary dump emits location and optional other-app load
            // metadata. These cannot stand in for a status record or new path.
            assertTrue("ART_PROFILE_REFUSED: unrecognized dump field",line.isEmpty()
                ||current&&line.startsWith("[location is ")&&line.endsWith("]")
                ||current&&line.startsWith("used by other apps: "));
        }
        assertEquals("ART_PROFILE_REFUSED: missing/duplicate package",1,packages);
        assertEquals("ART_PROFILE_REFUSED: missing/duplicate APK",1,paths);
        assertEquals("ART_PROFILE_REFUSED: missing/duplicate primary status",1,statuses);
    }

    private static byte[] hash(Path path) throws Exception {
        MessageDigest hash=MessageDigest.getInstance("SHA-256");
        try(var stream=Files.newInputStream(path)) {byte[] block=new byte[32_768];for(int n;(n=stream.read(block))!=-1;)hash.update(block,0,n);}
        return hash.digest();
    }
    private static String hex(byte[] bytes) {StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return s.toString();}
}
