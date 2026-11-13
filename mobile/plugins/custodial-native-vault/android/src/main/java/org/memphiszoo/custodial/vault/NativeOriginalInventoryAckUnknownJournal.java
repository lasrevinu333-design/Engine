package org.memphiszoo.custodial.vault;

import java.io.File;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFileAttributes;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** Fixed native UNKNOWN-before-first-dispatch retention, never a sender or ACK.
 * No existing disk state can mint another Unknown. A read-only observation
 * cannot authorize retry/resend. The private sender must separately enforce
 * its one transport attempt, original timestamp and current server eligibility.
 */
final class NativeOriginalInventoryAckUnknownJournal {
    static final String DIRECTORY="custodial-original-inventory-ack-dispatch-unknown-v1";
    static final String FAILURE="custodial_native_original_inventory_ack_dispatch_unknown";
    static final String SCHEMA="custodial.native-original-inventory-ack-dispatch-unknown.v1";
    static final String PURPOSE="ORIGINAL_REQUEST_OUTCOME_UNKNOWN_BEFORE_FIRST_SEND";
    private static final String LOCK="unknown.lock",PENDING="unknown.pending",COMMITTED="unknown.bin";
    private static final String FILE_SCHEMA="custodial.native-original-inventory-ack-dispatch-unknown-file.v1";
    private static final String CLEAR_SCHEMA="custodial.native-original-inventory-ack-dispatch-unknown-custody.v1";
    private static final String OBSERVATION_SCHEMA="custodial.native-original-inventory-ack-dispatch-unknown-observation.v1";
    private static final int MAX_MARKER=196608,MAX_CLEAR=262144,MAX_FILE=393216;
    private static final Set<String> ARTIFACTS=Set.of(LOCK,PENDING,COMMITTED);
    private static final Set<PosixFilePermission> DIR_MODE=PosixFilePermissions.fromString("rwx------");
    private static final Set<PosixFilePermission> FILE_MODE=PosixFilePermissions.fromString("rw-------");
    private final Path root,directory,lock,pending,committed;
    private final Stamp rootIdentity;
    private final AndroidKeystoreCipher cipher=new AndroidKeystoreCipher(
        "org.memphiszoo.custodial.native-original-inventory-ack-dispatch-unknown.v1",MAX_CLEAR);
    private final AtomicBoolean reservationTaken=new AtomicBoolean();
    private volatile boolean refused;

    private NativeOriginalInventoryAckUnknownJournal(File nativeRoot)throws VaultFailure {
        try {
            if(nativeRoot==null||!nativeRoot.isAbsolute()
                ||!nativeRoot.getAbsoluteFile().equals(nativeRoot.getCanonicalFile()))throw invalid();
            root=nativeRoot.toPath();
            rootIdentity=new Stamp(Files.readAttributes(root,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS),true);
            directory=root.resolve(DIRECTORY);lock=directory.resolve(LOCK);
            pending=directory.resolve(PENDING);committed=directory.resolve(COMMITTED);
        }catch(Exception unavailable){throw invalid();}
    }
    static NativeOriginalInventoryAckUnknownJournal fromNativeNoBackupRoot(File nativeRoot)throws VaultFailure {
        return new NativeOriginalInventoryAckUnknownJournal(nativeRoot);
    }

    /** One local reservation attempt. RequestControl.beginLocalRetention belongs
     * to the original signed-request journal and is deliberately NOT repeated.
     * No public data or existing marker can manufacture this handle.
     */
    Unknown reserveOriginalDispatchUnknown(VaultEngine.NativeOriginalInventoryAckRequestControl expected,
        NativeOriginalInventoryAckRequestJournal.Result original)throws VaultFailure {
        if(!reservationTaken.compareAndSet(false,true)){refused=true;throw invalid();}
        Unknown result=null;
        try {
            if(refused)throw invalid();
            if(original==null)throw invalid();
            original.claimFirstDispatchReservation(expected);
            Binding binding=new Binding(expected,original);
            Access access=new Access(binding);access.requireRoot();
            // Even an empty directory or a complete, authentic old marker is
            // an existing attempt, never absence permitting another dispatch.
            if(access.optional(directory,true)!=null)throw invalid();
            access.requireRoot();access.check();
            Files.createDirectory(directory,PosixFilePermissions.asFileAttribute(DIR_MODE));access.check();
            Stamp dir=access.required(directory,true);access.requirePair(dir);access.forceDirectory(root);
            access.check();
            try(FileChannel created=FileChannel.open(lock,Set.of(StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS),
                PosixFilePermissions.asFileAttribute(FILE_MODE))){
                access.check();Stamp before=access.required(lock,false);
                if(before.size!=0)throw invalid();
                access.check();created.force(true);access.check();
                if(!before.same(access.required(lock,false),true))throw invalid();access.check();
            }
            access.check();access.forceDirectory(directory);
            Snapshot initial=access.snapshot(dir);
            if(initial.lock==null||initial.lock.size!=0||initial.pending!=null||initial.bin!=null)throw invalid();
            access.check();
            try(FileChannel channel=FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
                access.check();
                try(FileLock held=channel.tryLock()){
                    access.check();access.requireLock(initial,channel,held);
                    access.requireSnapshot(initial,access.snapshot(dir));
                    result=retainNew(access,initial,channel,held);
                    access.requireLock(result.source,channel,held);
                    access.requireSnapshot(result.source,access.snapshot(dir));access.check();
                }
                access.check();
            }
            access.check();result.requireCurrent(expected);return result;
        }catch(VaultFailure failure){if(result!=null)result.close();refused=true;throw failure;}
        catch(Exception unavailable){if(result!=null)result.close();refused=true;throw invalid();}
        catch(Error unavailable){if(result!=null)result.close();refused=true;throw unavailable;}
    }

    /** DATA-only current read. No path creates, repairs, promotes or returns an
     * Unknown, including valid committed markers. Partial/mixed states refuse.
     * ABSENT is explicitly not proof that a send is permitted or never happened.
     */
    JSONObject inspectOriginalUnknown(VaultEngine.NativeOriginalInventoryAckRequestControl expected,
        NativeOriginalInventoryAckRequestJournal.Result original)throws VaultFailure {
        try {
            if(refused)throw invalid();
            Binding binding=new Binding(expected,original);Access access=new Access(binding);
            access.requireRoot();Stamp dir=access.optional(directory,true);
            if(dir==null){
                JSONObject value=observation("ABSENT_UNPROVEN_NOT_SEND_AUTHORITY",binding);
                access.requireRoot();
                if(access.optional(directory,true)!=null)throw invalid();
                access.requireRoot();access.check();return value;
            }
            Snapshot source=access.snapshot(dir);
            if(source.lock==null||source.lock.size!=0||source.pending!=null||source.bin==null)throw invalid();
            JSONObject value;
            access.check();
            try(FileChannel channel=FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
                access.check();
                try(FileLock held=channel.tryLock()){
                    access.check();byte[] bytes=access.readCommitted(source,channel,held),after=null;
                    try {
                        decode(bytes,source,access);
                        value=observation("EXISTING_DISPATCH_UNKNOWN_NOT_ACK",binding);
                        after=access.readCommitted(source,channel,held);
                        if(!MessageDigest.isEqual(bytes,after))throw invalid();
                        access.requireSnapshot(source,access.snapshot(dir));access.requireLock(source,channel,held);access.check();
                    }finally{Arrays.fill(bytes,(byte)0);if(after!=null)Arrays.fill(after,(byte)0);}
                }
                access.check();
            }
            access.check();return value;
        }catch(VaultFailure failure){refused=true;throw failure;}
        catch(Exception unavailable){refused=true;throw invalid();}
        catch(Error unavailable){refused=true;throw unavailable;}
    }

    private Unknown retainNew(Access access,Snapshot empty,FileChannel channel,FileLock held)throws Exception {
        byte[] encoded=null,readback=null;char[] clear=null;
        try {
            access.requireLock(empty,channel,held);access.requireSnapshot(empty,access.snapshot(empty.directory));access.check();
            Stamp created;
            String marker;
            try(FileChannel output=FileChannel.open(pending,Set.of(StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS),
                PosixFilePermissions.asFileAttribute(FILE_MODE))){
                access.check();created=access.required(pending,false);
                if(created.size!=0)throw invalid();
                Snapshot opened=new Snapshot(empty.directory,empty.lock,created,null);
                access.requireSnapshot(opened,access.snapshot(empty.directory));access.requireLock(opened,channel,held);
                marker=marker(access.binding);validateMarker(marker,access.binding);
                JSONObject custody=new JSONObject().put("schema",CLEAR_SCHEMA).put("document",marker)
                    .put("root_key",key(rootIdentity)).put("directory_key",key(empty.directory))
                    .put("lock_key",key(empty.lock)).put("record_key",key(created))
                    .put("root_owner",rootIdentity.owner).put("root_group",rootIdentity.group);
                byte[] plaintext=strictBytes(custody.toString(),MAX_CLEAR);
                try{clear=custody.toString().toCharArray();}finally{Arrays.fill(plaintext,(byte)0);}
                access.check();EncryptedSecret secret=cipher.encryptWithExistingKey(clear);access.check();
                VaultValidation.wipe(clear);clear=null;
                encoded=strictBytes(new JSONObject().put("schema",FILE_SCHEMA).put("ciphertext",secret.ciphertext).put("iv",secret.iv).toString(),MAX_FILE);
                access.requireSnapshot(opened,access.snapshot(empty.directory));access.requireLock(opened,channel,held);
                ByteBuffer bytes=ByteBuffer.wrap(encoded);
                while(bytes.hasRemaining()){
                    access.check();if(output.write(bytes)<=0)throw invalid();access.check();
                    access.requirePair(empty.directory);access.requireLock(opened,channel,held);
                    Stamp live=access.required(pending,false);
                    if(!created.same(live,false)||live.size!=bytes.position())throw invalid();
                }
                access.check();output.force(true);access.check();
                Stamp forced=access.required(pending,false);
                if(!created.same(forced,false)||forced.size!=encoded.length)throw invalid();
                created=forced;access.check();
            }
            access.check();Snapshot staged=new Snapshot(empty.directory,empty.lock,created,null);
            access.requireSnapshot(staged,access.snapshot(empty.directory));access.requireLock(staged,channel,held);
            readback=access.read(pending,created);
            if(!MessageDigest.isEqual(encoded,readback)||!marker.equals(decode(readback,staged,access)))throw invalid();
            Arrays.fill(readback,(byte)0);readback=null;
            access.forceDirectory(directory);access.requireSnapshot(staged,access.snapshot(empty.directory));
            access.requireLock(staged,channel,held);access.check();Files.createLink(committed,pending);access.check();
            Snapshot linked=new Snapshot(empty.directory,empty.lock,created,created);
            access.requireSnapshot(linked,access.snapshot(empty.directory));access.requireLock(linked,channel,held);
            access.check();if(!Files.isSameFile(committed,pending))throw invalid();access.check();
            access.forceDirectory(directory);access.requireSnapshot(linked,access.snapshot(empty.directory));
            readback=access.read(committed,created);
            if(!MessageDigest.isEqual(encoded,readback))throw invalid();
            Arrays.fill(readback,(byte)0);readback=null;
            // Only this successful original attempt can clean its own alias.
            // No existing disk state ever reaches this promotion/cleanup path.
            access.requireSnapshot(linked,access.snapshot(empty.directory));access.requireLock(linked,channel,held);
            access.check();Files.delete(pending);access.check();
            Snapshot finalSource=new Snapshot(empty.directory,empty.lock,null,created);
            access.forceDirectory(directory);access.requireSnapshot(finalSource,access.snapshot(empty.directory));
            access.requireLock(finalSource,channel,held);access.check();
            return new Unknown(this,access.binding,finalSource,encoded,marker);
        }finally{
            VaultValidation.wipe(clear);if(encoded!=null)Arrays.fill(encoded,(byte)0);
            if(readback!=null)Arrays.fill(readback,(byte)0);
        }
    }

    /** Non-reconstructible one-take handoff. It borrows the actual request and
     * control; close/refusal never closes either borrower, another issuer or key.
     */
    static final class Unknown implements AutoCloseable {
        private final NativeOriginalInventoryAckUnknownJournal owner;
        private final Binding binding;
        private final Snapshot source;
        private final AtomicBoolean taken=new AtomicBoolean();
        private byte[] encoded;
        private String marker;
        private volatile boolean closed;
        private Unknown(NativeOriginalInventoryAckUnknownJournal owner,Binding binding,Snapshot source,byte[] encoded,String marker){
            this.owner=owner;this.binding=binding;this.source=source;this.encoded=encoded.clone();this.marker=marker;
        }
        void requireCurrent(VaultEngine.NativeOriginalInventoryAckRequestControl expected)throws VaultFailure {
            if(closed)throw invalid();
            try {
                if(expected==null||expected!=binding.control||owner.refused)throw invalid();
                Access access=owner.new Access(binding);access.check();
                access.requireSnapshot(source,access.snapshot(source.directory));access.check();
                try(FileChannel channel=FileChannel.open(owner.lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
                    access.check();
                    try(FileLock held=channel.tryLock()){
                        access.check();byte[] live=access.readCommitted(source,channel,held);
                        try{
                            if(!MessageDigest.isEqual(encoded,live)||!marker.equals(owner.decode(live,source,access)))throw invalid();
                        }finally{Arrays.fill(live,(byte)0);}
                        access.requireSnapshot(source,access.snapshot(source.directory));access.requireLock(source,channel,held);access.check();
                    }
                    access.check();
                }
                access.check();
            }catch(VaultFailure failure){close();owner.refused=true;throw failure;}
            catch(Exception unavailable){close();owner.refused=true;throw invalid();}
            catch(Error unavailable){close();owner.refused=true;throw unavailable;}
        }
        NativeOriginalInventoryAckRequestJournal.Result.Original takeOriginalForOwningDispatch(
            VaultEngine.NativeOriginalInventoryAckRequestControl expected)throws VaultFailure {
            // Consumption precedes even expected-issuer validation and all IO.
            if(!taken.compareAndSet(false,true)){close();owner.refused=true;throw invalid();}
            try {
                requireCurrent(expected);
                var original=binding.original.originalForOwningDispatch(expected);
                binding.requireExact(original);
                requireCurrent(expected);return original;
            }catch(VaultFailure failure){close();owner.refused=true;throw failure;}
            catch(Exception unavailable){close();owner.refused=true;throw invalid();}
            catch(Error unavailable){close();owner.refused=true;throw unavailable;}
        }
        @Override public void close(){closed=true;if(encoded!=null)Arrays.fill(encoded,(byte)0);encoded=null;marker=null;}
    }

    /** Native references and immutable DATA only; never a caller-provided grant,
     * cached currentness verdict, raw callback or a replacement request.
     */
    private final class Binding {
        final VaultEngine.NativeOriginalInventoryAckRequestControl control;
        final NativeOriginalInventoryAckRequestJournal.Result original;
        final String document,diskSha,documentSha;
        Binding(VaultEngine.NativeOriginalInventoryAckRequestControl expected,
            NativeOriginalInventoryAckRequestJournal.Result original)throws Exception {
            if(expected==null||original==null)throw invalid();
            this.control=expected;this.original=original;
            expected.requireCurrent();original.requireCurrent();
            var data=original.originalForOwningDispatch(expected);
            document=data.document;diskSha=data.diskSha256;documentSha=data.documentSha256;
            if(document==null||diskSha==null||documentSha==null||!diskSha.matches("[0-9a-f]{64}")||!documentSha.matches("[0-9a-f]{64}"))throw invalid();
            byte[] bytes=strictBytes(document,VaultEngine.NativeOriginalInventoryAckRequestControl.MAX_DOCUMENT);
            try{if(!documentSha.equals(sha(bytes)))throw invalid();}finally{Arrays.fill(bytes,(byte)0);}
            requireCurrent();
        }
        void requireExact(NativeOriginalInventoryAckRequestJournal.Result.Original data)throws VaultFailure {
            if(data==null||!document.equals(data.document)||!diskSha.equals(data.diskSha256)||!documentSha.equals(data.documentSha256))throw invalid();
        }
        void requireCurrent()throws VaultFailure {
            control.requireCurrent();original.requireCurrent();
            requireExact(original.originalForOwningDispatch(control));control.requireCurrent();
        }
    }

    private static String marker(Binding binding)throws Exception {
        binding.requireCurrent();
        String text=new JSONObject().put("schema",SCHEMA).put("purpose",PURPOSE)
            .put("original_request_document",binding.document).put("original_request_disk_sha256",binding.diskSha)
            .put("original_request_document_sha256",binding.documentSha)
            .put("inventory_acknowledged",false).put("work_accepted",false).put("replay_allowed",false)
            .put("finalizer_allowed",false).put("key_removal",false).put("phone_released",false).toString();
        binding.requireCurrent();return text;
    }
    private static JSONObject observation(String state,Binding binding)throws Exception {
        binding.requireCurrent();
        JSONObject value=new JSONObject().put("schema",OBSERVATION_SCHEMA).put("state",state)
            .put("original_request_disk_sha256",binding.diskSha).put("original_request_document_sha256",binding.documentSha)
            .put("inventory_acknowledged",false).put("work_accepted",false).put("replay_allowed",false)
            .put("finalizer_allowed",false).put("key_removal",false).put("phone_released",false);
        binding.requireCurrent();return value;
    }
    private String decode(byte[] encoded,Snapshot source,Access access)throws Exception {
        char[] clear=null;byte[] bytes=null;
        try {
            JSONObject envelope=ProviderWireJson.object(encoded,MAX_FILE);
            NativeRetainedAttempt.keys(envelope,"schema","ciphertext","iv");
            if(!FILE_SCHEMA.equals(envelope.get("schema")))throw invalid();
            String ciphertext=string(envelope,"ciphertext"),iv=string(envelope,"iv");
            requireBase64(ciphertext,16,MAX_CLEAR+16);requireBase64(iv,12,12);
            access.check();clear=cipher.decrypt(new EncryptedSecret(ciphertext,iv,MAX_FILE));access.check();
            bytes=strictBytes(new String(clear),MAX_CLEAR);
            JSONObject custody=ProviderWireJson.object(bytes,MAX_CLEAR);
            NativeRetainedAttempt.keys(custody,"schema","document","root_key","directory_key","lock_key","record_key","root_owner","root_group");
            Stamp record=source.bin==null?source.pending:source.bin;
            if(record==null||!CLEAR_SCHEMA.equals(custody.get("schema"))
                ||!key(rootIdentity).equals(string(custody,"root_key"))
                ||!key(source.directory).equals(string(custody,"directory_key"))
                ||!key(source.lock).equals(string(custody,"lock_key"))
                ||!key(record).equals(string(custody,"record_key"))
                ||!rootIdentity.owner.equals(string(custody,"root_owner"))
                ||!rootIdentity.group.equals(string(custody,"root_group")))throw invalid();
            String marker=string(custody,"document");validateMarker(marker,access.binding);
            access.requireSnapshot(source,access.snapshot(source.directory));access.check();return marker;
        }finally{VaultValidation.wipe(clear);if(bytes!=null)Arrays.fill(bytes,(byte)0);}
    }
    private static void validateMarker(String marker,Binding binding)throws Exception {
        byte[] bytes=strictBytes(marker,MAX_MARKER),request=null;
        try {
            JSONObject value=ProviderWireJson.object(bytes,MAX_MARKER);
            NativeRetainedAttempt.keys(value,"schema","purpose","original_request_document","original_request_disk_sha256",
                "original_request_document_sha256","inventory_acknowledged","work_accepted","replay_allowed",
                "finalizer_allowed","key_removal","phone_released");
            if(!SCHEMA.equals(value.get("schema"))||!PURPOSE.equals(value.get("purpose"))
                ||!binding.document.equals(value.get("original_request_document"))
                ||!binding.diskSha.equals(value.get("original_request_disk_sha256"))
                ||!binding.documentSha.equals(value.get("original_request_document_sha256")))throw invalid();
            request=strictBytes(string(value,"original_request_document"),VaultEngine.NativeOriginalInventoryAckRequestControl.MAX_DOCUMENT);
            if(!binding.documentSha.equals(sha(request)))throw invalid();
            for(String name:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(value.get(name)))throw invalid();
            binding.requireCurrent();
        }finally{Arrays.fill(bytes,(byte)0);if(request!=null)Arrays.fill(request,(byte)0);}
    }

    /** Fixed synchronous IO composition. Stamps are expected original DATA,
     * never successful-currentness caches; each use reopens actual identities.
     */
    private final class Access {
        final Binding binding;
        Access(Binding binding){this.binding=binding;}
        void check()throws VaultFailure{if(refused)throw invalid();binding.requireCurrent();}
        Stamp optional(Path path,boolean dir)throws Exception {
            check();PosixFileAttributes attrs;
            try{attrs=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);}
            catch(NoSuchFileException absent){check();return null;}
            check();Stamp value=new Stamp(attrs,dir);
            if(!rootIdentity.owner.equals(value.owner)||!rootIdentity.group.equals(value.group))throw invalid();return value;
        }
        Stamp required(Path path,boolean dir)throws Exception{Stamp value=optional(path,dir);if(value==null)throw invalid();return value;}
        void requireRoot()throws Exception {
            check();if(!root.toFile().getAbsoluteFile().equals(root.toFile().getCanonicalFile()))throw invalid();check();
            if(!rootIdentity.same(required(root,true),false))throw invalid();
        }
        void requirePair(Stamp dir)throws Exception {
            requireRoot();check();if(!directory.toFile().getAbsoluteFile().equals(directory.toFile().getCanonicalFile()))throw invalid();check();
            if(!dir.same(required(directory,true),false))throw invalid();requireRoot();
        }
        Snapshot snapshot(Stamp dir)throws Exception {
            requirePair(dir);check();
            try(DirectoryStream<Path> names=Files.newDirectoryStream(directory)){
                check();for(Path name:names){check();if(!ARTIFACTS.contains(name.getFileName().toString()))throw invalid();check();}check();
            }
            check();Stamp l=optional(lock,false),p=optional(pending,false),b=optional(committed,false);
            if(l!=null&&(l.size!=0||(p!=null&&l.key.equals(p.key))||(b!=null&&l.key.equals(b.key))))throw invalid();
            if(p!=null&&(p.size<0||p.size>MAX_FILE)||b!=null&&(b.size<1||b.size>MAX_FILE))throw invalid();
            requirePair(dir);return new Snapshot(dir,l,p,b);
        }
        void requireSnapshot(Snapshot expected,Snapshot actual)throws VaultFailure {
            if(!same(expected.directory,actual.directory,false)||!same(expected.lock,actual.lock,true)
                ||!same(expected.pending,actual.pending,true)||!same(expected.bin,actual.bin,true))throw invalid();
        }
        void requireLock(Snapshot source,FileChannel channel,FileLock held)throws Exception {
            check();if(held==null||!held.isValid()||held.channel()!=channel)throw invalid();
            if(source.lock==null||!source.lock.same(required(lock,false),true))throw invalid();
            check();if(channel.size()!=0)throw invalid();check();requirePair(source.directory);
        }
        byte[] readCommitted(Snapshot source,FileChannel channel,FileLock held)throws Exception {
            if(source.pending!=null||source.bin==null)throw invalid();
            requireLock(source,channel,held);requireSnapshot(source,snapshot(source.directory));
            byte[] bytes=read(committed,source.bin);
            try{requireSnapshot(source,snapshot(source.directory));requireLock(source,channel,held);return bytes;}
            catch(Exception failure){Arrays.fill(bytes,(byte)0);throw failure;}
            catch(Error failure){Arrays.fill(bytes,(byte)0);throw failure;}
        }
        byte[] read(Path path,Stamp expected)throws Exception {
            if(expected.size<1||expected.size>MAX_FILE||!expected.same(required(path,false),true))throw invalid();
            byte[] bytes=new byte[(int)expected.size];boolean success=false;
            try {
                check();try(FileChannel input=FileChannel.open(path,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
                    check();ByteBuffer buffer=ByteBuffer.wrap(bytes);
                    while(buffer.hasRemaining()){check();if(input.read(buffer)<=0)throw invalid();check();}
                    check();if(input.read(ByteBuffer.allocate(1))!=-1)throw invalid();check();
                    if(input.size()!=expected.size)throw invalid();check();
                    if(!expected.same(required(path,false),true))throw invalid();check();
                }
                check();if(!expected.same(required(path,false),true))throw invalid();success=true;return bytes;
            }finally{if(!success)Arrays.fill(bytes,(byte)0);}
        }
        void forceDirectory(Path path)throws Exception {
            check();try(FileChannel channel=FileChannel.open(path,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
                check();channel.force(true);check();
            }check();
        }
    }
    private static final class Snapshot {
        final Stamp directory,lock,pending,bin;
        Snapshot(Stamp directory,Stamp lock,Stamp pending,Stamp bin){this.directory=directory;this.lock=lock;this.pending=pending;this.bin=bin;}
    }
    private static final class Stamp {
        final Object key;final long size;final java.nio.file.attribute.FileTime modified;
        final String owner,group;final Set<PosixFilePermission> mode;
        final java.nio.file.attribute.UserPrincipal ownerIdentity;
        final java.nio.file.attribute.GroupPrincipal groupIdentity;
        Stamp(PosixFileAttributes attrs,boolean directory)throws VaultFailure {
            if(attrs.isSymbolicLink()||attrs.fileKey()==null||(directory?!attrs.isDirectory():!attrs.isRegularFile())
                ||!attrs.permissions().equals(directory?DIR_MODE:FILE_MODE))throw invalid();
            key=attrs.fileKey();size=attrs.size();modified=attrs.lastModifiedTime();
            ownerIdentity=attrs.owner();groupIdentity=attrs.group();
            owner=ownerIdentity.getName();group=groupIdentity.getName();mode=Set.copyOf(attrs.permissions());
            if(owner.isEmpty()||group.isEmpty())throw invalid();
        }
        boolean same(Stamp other,boolean file){return other!=null&&key.equals(other.key)&&ownerIdentity.equals(other.ownerIdentity)
            &&groupIdentity.equals(other.groupIdentity)&&owner.equals(other.owner)&&group.equals(other.group)
            &&mode.equals(other.mode)&&(!file||size==other.size&&modified.equals(other.modified));}
    }
    private static boolean same(Stamp a,Stamp b,boolean file){return a==null?b==null:a.same(b,file);}
    private static String key(Stamp value)throws VaultFailure {
        if(value==null)throw invalid();String key=value.key.toString();if(key.isEmpty()||key.length()>1024)throw invalid();return key;
    }
    private static String string(JSONObject value,String name)throws Exception {
        Object raw=value.get(name);if(!(raw instanceof String)||((String)raw).isEmpty())throw invalid();return (String)raw;
    }
    private static byte[] strictBytes(String text,int maximum)throws Exception {
        if(text==null||text.length()>maximum)throw invalid();
        ByteBuffer buffer=StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).encode(CharBuffer.wrap(text));
        if(buffer.remaining()<1||buffer.remaining()>maximum)throw invalid();
        byte[] bytes=new byte[buffer.remaining()];buffer.get(bytes);if(buffer.hasArray())Arrays.fill(buffer.array(),(byte)0);return bytes;
    }
    private static void requireBase64(String value,int minimum,int maximum)throws Exception {
        byte[] bytes=Base64.getDecoder().decode(value);
        try{if(bytes.length<minimum||bytes.length>maximum||!Base64.getEncoder().encodeToString(bytes).equals(value))throw invalid();}
        finally{Arrays.fill(bytes,(byte)0);}
    }
    private static String sha(byte[] bytes)throws Exception {
        byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder text=new StringBuilder(64);
        for(byte value:digest)text.append(String.format(java.util.Locale.ROOT,"%02x",value&255));return text.toString();
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
