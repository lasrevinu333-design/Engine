package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.nio.file.attribute.PosixFileAttributes;
import java.security.MessageDigest;
import java.util.*;
import org.json.JSONArray;
import org.json.JSONObject;

/** DATA witness of the two existing original-custody directories. No path is
 * accepted from a page, wire, record or preference. The native finalizer and
 * retained-partition reader supply their actual fixed original root. This
 * checks preservation of bytes; it never accepts work or grants a finalizer. */
final class NativeRetainedEnrollmentFiles {
    private static final String[] DOMAINS={"custodial-private-eight-custody-v1","custodial-private-eight-custody-exchange-v1"};
    private static final int MAX_FILES=4096;
    interface Check {void current()throws VaultFailure;}
    static String capture(Path actualRoot,Check check)throws VaultFailure {
        try{
            if(actualRoot==null||check==null||!actualRoot.isAbsolute()||!actualRoot.toRealPath().equals(actualRoot))throw failure();
            check.current();var root=directory(actualRoot);JSONArray domains=new JSONArray();int count=0;
            for(String domain:DOMAINS){
                Path dir=actualRoot.resolve(domain);var before=directory(dir);
                if(!root.owner().equals(before.owner()))throw failure();
                List<String> names=names(dir);JSONArray files=new JSONArray();
                for(String name:names){
                    if(++count>MAX_FILES||!name.matches("[A-Za-z0-9_-]+\\.(?:bin|pending|lock)"))throw failure();
                    check.current();Path path=dir.resolve(name);var a=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                    if(!a.isRegularFile()||a.fileKey()==null||a.size()<0||a.size()>128L*1024*1024||!root.owner().equals(a.owner()))throw failure();
                    MessageDigest hash=MessageDigest.getInstance("SHA-256");long bytes=0;
                    try(FileChannel c=FileChannel.open(path,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
                        ByteBuffer buffer=ByteBuffer.allocate(65536);int n;
                        while((n=c.read(buffer))!=-1){check.current();if(n==0)continue;bytes+=n;if(bytes>a.size())throw failure();buffer.flip();hash.update(buffer);buffer.clear();}
                    }
                    var b=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                    if(bytes!=a.size()||!a.fileKey().equals(b.fileKey())||a.size()!=b.size()||!a.lastModifiedTime().equals(b.lastModifiedTime()))throw failure();
                    files.put(new JSONObject().put("name",name).put("file_identity",a.fileKey().toString())
                        .put("bytes",Long.toString(bytes)).put("sha256",hex(hash.digest())));
                }
                if(!names.equals(names(dir))||!before.fileKey().equals(directory(dir).fileKey()))throw failure();
                domains.put(new JSONObject().put("domain",domain).put("directory_identity",before.fileKey().toString()).put("files",files));
                check.current();
            }
            if(!root.fileKey().equals(directory(actualRoot).fileKey()))throw failure();
            return new JSONObject().put("schema","custodial.retained-original-custody-files.v1")
                .put("root_identity",root.fileKey().toString()).put("domains",domains).toString();
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE,e);}
    }
    static void requireSame(Path actualRoot,String original,Check check)throws VaultFailure {
        if(original==null||!original.equals(capture(actualRoot,check)))throw failure();
    }
    private static List<String> names(Path dir)throws Exception {
        List<String> names=new ArrayList<>();try(DirectoryStream<Path> entries=Files.newDirectoryStream(dir)){
            for(Path path:entries){if(names.size()>=MAX_FILES)throw failure();names.add(path.getFileName().toString());}
        }Collections.sort(names);return names;
    }
    private static PosixFileAttributes directory(Path path)throws Exception {
        var a=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);if(!a.isDirectory()||a.fileKey()==null)throw failure();return a;
    }
    private static String hex(byte[] bytes){StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();}
    private static VaultFailure failure(){return new VaultFailure(NativeRetainedEnrollmentRealmStore.FAILURE);}
    private NativeRetainedEnrollmentFiles(){}
}
