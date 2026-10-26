package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFileAttributes;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.util.Map;
import java.util.TreeMap;
import org.junit.Test;

/** Only absent-issuer admission. No positive control, key, format-valid ACK
 * record or HELD/browser authority is manufactured. Owned originals retained.
 */
public final class NativeOriginalInventoryAckIntentJournalTest {
    public static void main(String[] args)throws Exception {
        if(args.length!=2||!"--null-owner-only".equals(args[0])
            ||!java.util.Set.of("NULL_OWNER_absentJournalHasNoEffects","NULL_OWNER_existingUnknownOriginalsStayExact").contains(args[1]))
            throw new IllegalArgumentException("Select one new null-owner journal member");
        var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeOriginalInventoryAckIntentJournalTest.class,args[1]));
        for(var failure:result.getFailures())System.err.println(failure.getTrace());
        if(!result.wasSuccessful()||result.getRunCount()!=1)throw new AssertionError("New null-owner admission failed");
        System.out.println("PASS_NULL_OWNER_NO_EFFECT "+args[1]);
        System.out.println("LIVE_ISSUER_AND_JOURNAL_IO_NOT_RUN; LOCAL_INTENT_IS_NOT_ACK");
    }
    @Test public void NULL_OWNER_absentJournalHasNoEffects()throws Exception {
        Path root=root("ack-intent-absent-");Map<String,String> original=snapshot(root);
        var store=NativeOriginalInventoryAckIntentJournal.fromNativeNoBackupRoot(root.toFile());
        refused(store);assertEquals(original,snapshot(root));
        assertFalse(Files.exists(root.resolve(NativeOriginalInventoryAckIntentJournal.DIRECTORY),LinkOption.NOFOLLOW_LINKS));
    }
    @Test public void NULL_OWNER_existingUnknownOriginalsStayExact()throws Exception {
        Path root=root("ack-intent-unknown-");
        Path directory=Files.createDirectory(root.resolve(NativeOriginalInventoryAckIntentJournal.DIRECTORY),PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        for(String name:new String[]{"intent.lock","intent.pending","intent.bin","unknown-retained"}){
            Path path=Files.createFile(directory.resolve(name),PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
            if(!"intent.lock".equals(name))Files.write(path,("UNKNOWN_DENIAL_DATA_"+name).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        Map<String,String> original=snapshot(root);
        var store=NativeOriginalInventoryAckIntentJournal.fromNativeNoBackupRoot(root.toFile());
        refused(store);assertEquals(original,snapshot(root));
    }
    private static void refused(NativeOriginalInventoryAckIntentJournal store)throws Exception {
        boolean denied=false;
        try(var unexpected=store.retainOriginalIntent(null)){fail("Null control cannot return an observation");}
        catch(VaultFailure failure){assertEquals(NativeOriginalInventoryAckIntentJournal.FAILURE,failure.code);denied=true;}
        assertTrue(denied);
    }
    private static Path root(String prefix)throws Exception {
        Path parent=Path.of(System.getProperty("custodial.custody.fixture.root"));
        assertTrue("Use the owned existing fixture parent",Files.isDirectory(parent));
        return Files.createTempDirectory(parent,prefix,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
    }
    private static Map<String,String> snapshot(Path root)throws Exception {
        Map<String,String> result=new TreeMap<>();
        try(var names=Files.walk(root)){
            for(Path path:names.sorted().toList()){
                var attrs=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                String bytes="";
                if(attrs.isRegularFile())bytes=java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path)));
                result.put(root.relativize(path).toString(),attrs.fileKey()+"/"+attrs.size()+"/"+attrs.lastModifiedTime()+"/"
                    +attrs.owner()+"/"+attrs.group()+"/"+attrs.permissions()+"/"+bytes);
            }
        }
        return result;
    }
}
