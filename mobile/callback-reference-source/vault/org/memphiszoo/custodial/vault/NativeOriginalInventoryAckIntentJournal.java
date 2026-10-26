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
import org.json.JSONObject;

/** Fixed native LOCAL intent retention. Neither a file nor its DATA projection
 * is an ACK, send capability, acceptance, retry permission or key capability.
 * Only the private Engine issuer selects an original document. Unknown setup,
 * pending, aliases and partial writes are retained, never automatically resumed.
 */
final class NativeOriginalInventoryAckIntentJournal {
    static final String DIRECTORY="custodial-original-inventory-ack-intent-v1";
    static final String FAILURE="custodial_native_original_inventory_ack_intent_unknown";
    private static final String LOCK="intent.lock",PENDING="intent.pending",COMMITTED="intent.bin";
    private static final String FILE_SCHEMA="custodial.native-original-inventory-ack-intent-file.v1";
    private static final String CLEAR_SCHEMA="custodial.native-original-inventory-ack-intent-custody.v1";
    private static final String OBSERVATION_SCHEMA="custodial.native-original-inventory-ack-intent-observation.v1";
    private static final String STATE="LOCAL_ACK_INTENT_ONLY_NOT_ACK";
    private static final int MAX_DOCUMENT=16384,MAX_CLEAR=65536,MAX_FILE=98304;
    private static final Set<String> ARTIFACTS=Set.of(LOCK,PENDING,COMMITTED);
    private static final Set<PosixFilePermission> DIR_MODE=PosixFilePermissions.fromString("rwx------");
    private static final Set<PosixFilePermission> FILE_MODE=PosixFilePermissions.fromString("rw-------");
    private final Path root,directory,lock,pending,committed;
    private final Stamp rootIdentity;
    private final AndroidKeystoreCipher cipher=new AndroidKeystoreCipher(
        "org.memphiszoo.custodial.native-original-inventory-ack-intent.v1",MAX_CLEAR);
    private volatile boolean refused;

    private NativeOriginalInventoryAckIntentJournal(File nativeRoot)throws VaultFailure {
        try {
            if(nativeRoot==null||!nativeRoot.isAbsolute()
                ||!nativeRoot.getAbsoluteFile().equals(nativeRoot.getCanonicalFile()))throw invalid();
            root=nativeRoot.toPath();rootIdentity=new Stamp(Files.readAttributes(root,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS),true);
            directory=root.resolve(DIRECTORY);lock=directory.resolve(LOCK);
            pending=directory.resolve(PENDING);committed=directory.resolve(COMMITTED);
        }catch(Exception unavailable){throw invalid();}
    }
    static NativeOriginalInventoryAckIntentJournal fromNativeNoBackupRoot(File nativeRoot)throws VaultFailure {
        return new NativeOriginalInventoryAckIntentJournal(nativeRoot);
    }

    /** Caller already holds the issuing Engine monitor. No scalar/JSON can
     * replace this issuer, and no test cipher or configurable path is accepted.
     * An exception consumes the attempt and preserves every partial original.
     */
    Result retainOriginalIntent(VaultEngine.NativeOriginalInventoryAckIntentControl control)throws VaultFailure {
        if(control==null)throw invalid(); // no directory, key or file IO on absent authority
        Access access=new Access(control);
        Result result=null;
        try {
            if(refused)throw invalid();
            control.beginLocalRetention();
            access.requireRoot();
            Stamp dir=access.optional(directory,true);
            boolean fresh=dir==null;
            if(fresh){
                access.check();Files.createDirectory(directory,PosixFilePermissions.asFileAttribute(DIR_MODE));access.check();
                dir=access.required(directory,true);access.requirePair(dir);access.forceDirectory(root);
                // Persistent partial setup precedes native ID/time selection.
                // A later invocation must not reinterpret an empty directory or lock-only state as fresh.
                access.check();
                try(FileChannel channel=FileChannel.open(lock,Set.of(StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS),
                    PosixFilePermissions.asFileAttribute(FILE_MODE))){
                    access.check();Stamp created=access.required(lock,false);
                    if(created.size!=0)throw invalid();
                    access.check();channel.force(true);access.check();
                    if(!created.same(access.required(lock,false),true))throw invalid();
                    access.check();
                }
                access.check();access.forceDirectory(directory);
            }
            Snapshot initial=access.snapshot(dir);
            if(initial.lock==null||initial.lock.size!=0||initial.pending!=null
                ||(fresh?initial.bin!=null:initial.bin==null))throw invalid();
            access.check();
            try(FileChannel channel=FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
                access.check();
                try(FileLock held=channel.tryLock()){
                    access.check();access.requireLock(initial,channel,held);
                    access.requireSnapshot(initial,access.snapshot(dir));
                    if(fresh)result=retainNew(access,initial,channel,held);
                    else result=readCommitted(access,initial,channel,held);
                    // Terminal exact held-lock check, never recursively acquire intent.lock.
                    access.requireLock(result.source,channel,held);
                    access.requireSnapshot(result.source,access.snapshot(dir));
                    access.check();
                }
                access.check();
            }
            access.check();
            result.requireCurrent();
            return result;
        }catch(VaultFailure failure){if(result!=null)result.close();refused=true;control.close();throw failure;}
        catch(Exception unavailable){if(result!=null)result.close();refused=true;control.close();throw invalid();}
        catch(Error unavailable){if(result!=null)result.close();refused=true;control.close();throw unavailable;}
    }


    /** Existing-only status/recovery read. Absence is DATA, never send
     * authority. No creation, force, encryption, promotion, cleanup or repair
     * path is reachable from this entry. A partial/ambiguous journal refuses.
     */
    Result inspectOriginalIntent(VaultEngine.NativeOriginalInventoryAckIntentControl control)throws VaultFailure {
        if(control==null)throw invalid();
        Access access=new Access(control);
        Result result=null;
        try {
            if(refused)throw invalid();
            // One ephemeral validation attempt, not a durable mutation grant.
            control.beginLocalRetention();
            access.requireRoot();
            Stamp dir=access.optional(directory,true);
            if(dir==null){
                access.requireRoot();
                if(access.optional(directory,true)!=null)throw invalid();
                access.requireRoot();access.check();return null;
            }
            Snapshot initial=access.snapshot(dir);
            if(initial.lock==null||initial.lock.size!=0||initial.pending!=null||initial.bin==null)throw invalid();
            access.check();
            // WRITE opens only the existing zero-length lock for exclusive
            // tryLock. No CREATE/TRUNCATE/APPEND, file write or force occurs.
            try(FileChannel channel=FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
                access.check();
                try(FileLock held=channel.tryLock()){
                    access.check();access.requireLock(initial,channel,held);
                    access.requireSnapshot(initial,access.snapshot(dir));
                    result=readCommitted(access,initial,channel,held);
                    access.requireLock(result.source,channel,held);
                    access.requireSnapshot(result.source,access.snapshot(dir));access.check();
                }
                access.check();
            }
            access.check();
            // Independent terminal lock acquisition only AFTER releasing the
            // preceding lock; retainNew/null-document selection is never used.
            result.requireCurrent();return result;
        }catch(VaultFailure failure){if(result!=null)result.close();refused=true;control.close();throw failure;}
        catch(Exception unavailable){if(result!=null)result.close();refused=true;control.close();throw invalid();}
        catch(Error unavailable){if(result!=null)result.close();refused=true;control.close();throw unavailable;}
    }

    private Result readCommitted(Access access,Snapshot source,FileChannel channel,FileLock held)throws Exception {
        byte[] encoded=null;
        try {
            encoded=access.readCommitted(source,channel,held);
            String document=decode(encoded,source,access);
            String selected=access.control.originalDocumentForLocalRetention(document);
            if(!document.equals(selected))throw invalid();
            access.requireSnapshot(source,access.snapshot(source.directory));
            access.requireLock(source,channel,held);access.check();
            return new Result(this,access.control,source,encoded,document);
        }finally{if(encoded!=null)Arrays.fill(encoded,(byte)0);}
    }

    private Result retainNew(Access access,Snapshot empty,FileChannel channel,FileLock held)throws Exception {
        byte[] encoded=null,readback=null;
        char[] clear=null;
        try {
            access.requireLock(empty,channel,held);access.requireSnapshot(empty,access.snapshot(empty.directory));
            access.check();
            Stamp created;
            try(FileChannel output=FileChannel.open(pending,Set.of(StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS),
                PosixFilePermissions.asFileAttribute(FILE_MODE))){
                access.check();created=access.required(pending,false);
                if(created.size!=0)throw invalid();
                Snapshot opened=new Snapshot(empty.directory,empty.lock,created,null);
                access.requireSnapshot(opened,access.snapshot(empty.directory));access.requireLock(opened,channel,held);
                String document=access.control.originalDocumentForLocalRetention(null);
                validateDocument(document);
                JSONObject custody=new JSONObject().put("schema",CLEAR_SCHEMA).put("document",document)
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
            access.check();
            Snapshot staged=new Snapshot(empty.directory,empty.lock,created,null);
            access.requireSnapshot(staged,access.snapshot(empty.directory));access.requireLock(staged,channel,held);
            readback=access.read(pending,created);
            if(!MessageDigest.isEqual(encoded,readback))throw invalid();Arrays.fill(readback,(byte)0);readback=null;
            // Authenticate the actual forced original, including its privately selected inode.
            String document=decode(encoded,staged,access);
            access.forceDirectory(directory);access.requireSnapshot(staged,access.snapshot(empty.directory));
            access.requireLock(staged,channel,held);access.check();
            Files.createLink(committed,pending);access.check();
            Snapshot linked=new Snapshot(empty.directory,empty.lock,created,created);
            access.requireSnapshot(linked,access.snapshot(empty.directory));access.requireLock(linked,channel,held);
            access.check();if(!Files.isSameFile(committed,pending))throw invalid();access.check();
            access.forceDirectory(directory);access.requireSnapshot(linked,access.snapshot(empty.directory));
            readback=access.read(committed,created);
            if(!MessageDigest.isEqual(encoded,readback))throw invalid();Arrays.fill(readback,(byte)0);readback=null;
            // Only this successful attempt may remove its own exact alias.
            // Existing aliases discovered on entry are always UNKNOWN, not resumed.
            access.requireSnapshot(linked,access.snapshot(empty.directory));access.requireLock(linked,channel,held);
            access.check();Files.delete(pending);access.check();
            Snapshot finalSource=new Snapshot(empty.directory,empty.lock,null,created);
            access.forceDirectory(directory);access.requireSnapshot(finalSource,access.snapshot(empty.directory));
            access.requireLock(finalSource,channel,held);access.check();
            return new Result(this,access.control,finalSource,encoded,document);
        }finally{
            VaultValidation.wipe(clear);
            if(encoded!=null)Arrays.fill(encoded,(byte)0);
            if(readback!=null)Arrays.fill(readback,(byte)0);
        }
    }

    /** Borrowed live observation, never a send/ACK capability. Close only
     * retires this observation, not the issuer, shared key or retained original.
     */
    static final class Result implements AutoCloseable {
        private final NativeOriginalInventoryAckIntentJournal owner;
        private final VaultEngine.NativeOriginalInventoryAckIntentControl control;
        private final Snapshot source;
        private byte[] encoded;
        private String document,diskSha,documentSha;
        private boolean closed;
        private Result(NativeOriginalInventoryAckIntentJournal owner,VaultEngine.NativeOriginalInventoryAckIntentControl control,
            Snapshot source,byte[] encoded,String document)throws Exception {
            this.owner=owner;this.control=control;this.source=source;this.encoded=encoded.clone();this.document=document;
            diskSha=sha(encoded);byte[] original=strictBytes(document,MAX_DOCUMENT);
            try{documentSha=sha(original);}finally{Arrays.fill(original,(byte)0);}
        }
        void requireCurrent()throws VaultFailure {
            if(closed)throw invalid(); // closed observation cannot retire a separately owned live issuer
            try {
                if(owner.refused)throw invalid();
                Access access=owner.new Access(control);access.check();
                access.requireSnapshot(source,access.snapshot(source.directory));access.check();
                try(FileChannel channel=FileChannel.open(owner.lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
                    access.check();
                    try(FileLock held=channel.tryLock()){
                        access.check();byte[] live=access.readCommitted(source,channel,held);
                        try{if(!MessageDigest.isEqual(encoded,live))throw invalid();}
                        finally{Arrays.fill(live,(byte)0);}
                        access.requireSnapshot(source,access.snapshot(source.directory));access.requireLock(source,channel,held);access.check();
                    }
                    access.check();
                }
                access.check();
            }catch(VaultFailure failure){close();owner.refused=true;control.close();throw failure;}
            catch(Exception unavailable){close();owner.refused=true;control.close();throw invalid();}
            catch(Error unavailable){close();owner.refused=true;control.close();throw unavailable;}
        }
        /** Detached original DATA for the same private native issuer only.
         * A tuple cannot sign, send, acknowledge or confer currentness. No
         * tuple escapes until both locked file checks and terminal live checks
         * succeed; a mismatch retires this Result, never a foreign issuer.
         */
        static final class Original {
            final String document,diskSha256,documentSha256;
            private Original(String document,String diskSha256,String documentSha256){
                this.document=document;this.diskSha256=diskSha256;this.documentSha256=documentSha256;
            }
        }
        Original originalForOwningRequest(VaultEngine.NativeOriginalInventoryAckIntentControl expected)throws VaultFailure {
            if(closed)throw invalid();
            try {
                if(expected==null||expected!=control||owner.refused)throw invalid();
                Access access=owner.new Access(control);access.check();
                access.requireSnapshot(source,access.snapshot(source.directory));access.check();
                Original original;
                try(FileChannel channel=FileChannel.open(owner.lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
                    access.check();
                    try(FileLock held=channel.tryLock()){
                        access.check();byte[] live=access.readCommitted(source,channel,held);
                        try {
                            if(!MessageDigest.isEqual(encoded,live)||!diskSha.equals(sha(live))||!diskSha.equals(sha(encoded)))throw invalid();
                            // Decrypt the actual exact original under the existing
                            // fixed lock; never accept a caller document or digest.
                            String authenticated=owner.decode(live,source,access);
                            if(!document.equals(authenticated))throw invalid();
                            byte[] bytes=strictBytes(authenticated,MAX_DOCUMENT);
                            try {
                                if(!documentSha.equals(sha(bytes)))throw invalid();
                                original=new Original(new String(authenticated),new String(diskSha),new String(documentSha));
                            }finally{Arrays.fill(bytes,(byte)0);}
                        }finally{Arrays.fill(live,(byte)0);}
                        // The detached copy is not a cached source verdict.
                        // Reopen/read the exact original after copying too.
                        byte[] after=access.readCommitted(source,channel,held);
                        try {
                            if(!MessageDigest.isEqual(encoded,after)||!original.diskSha256.equals(sha(after))
                                ||!document.equals(original.document)||!documentSha.equals(original.documentSha256))throw invalid();
                        }finally{Arrays.fill(after,(byte)0);}
                        access.requireSnapshot(source,access.snapshot(source.directory));access.requireLock(source,channel,held);access.check();
                    }
                    access.check();
                }
                access.check();
                // The lock is released before this independently locked terminal
                // read. No recursive intent.lock acquisition or substituted owner.
                requireCurrent();return original;
            }catch(VaultFailure failure){close();owner.refused=true;control.close();throw failure;}
            catch(Exception unavailable){close();owner.refused=true;control.close();throw invalid();}
            catch(Error unavailable){close();owner.refused=true;control.close();throw unavailable;}
        }
        JSONObject projection()throws VaultFailure {
            requireCurrent();
            try {
                JSONObject value=new JSONObject().put("schema",OBSERVATION_SCHEMA).put("state",STATE)
                    .put("intent_document_sha256",documentSha).put("disk_sha256",diskSha)
                    .put("inventory_acknowledged",false).put("work_accepted",false).put("replay_allowed",false)
                    .put("finalizer_allowed",false).put("key_removal",false).put("phone_released",false);
                control.requireCurrent();return value;
            }catch(VaultFailure failure){close();owner.refused=true;control.close();throw failure;}
            catch(Exception unavailable){close();owner.refused=true;control.close();throw invalid();}
            catch(Error unavailable){close();owner.refused=true;control.close();throw unavailable;}
        }
        @Override public void close(){closed=true;if(encoded!=null)Arrays.fill(encoded,(byte)0);encoded=null;document=null;diskSha=null;documentSha=null;}
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
            String document=string(custody,"document");validateDocument(document);
            access.requireSnapshot(source,access.snapshot(source.directory));access.check();return document;
        }finally{VaultValidation.wipe(clear);if(bytes!=null)Arrays.fill(bytes,(byte)0);}
    }
    private static void validateDocument(String document)throws Exception {
        byte[] bytes=strictBytes(document,MAX_DOCUMENT);
        try {
            JSONObject value=ProviderWireJson.object(bytes,MAX_DOCUMENT);
            NativeRetainedAttempt.keys(value,"schema","purpose","intent_id","original_target","native_held_stamp",
                "browser_frame_sha256","browser_part_set_sha256","created_at","inventory_acknowledged","work_accepted",
                "replay_allowed","finalizer_allowed","key_removal","phone_released");
            if(!VaultEngine.NativeOriginalInventoryAckIntentControl.SCHEMA.equals(value.get("schema"))
                ||!VaultEngine.NativeOriginalInventoryAckIntentControl.PURPOSE.equals(value.get("purpose")))throw invalid();
            String id=string(value,"intent_id");if(!id.equals(NativeNfcOriginalWriteAttempt.uuid(id)))throw invalid();
            if(!(value.get("original_target") instanceof JSONObject)||string(value,"native_held_stamp").length()>1024
                ||!string(value,"browser_frame_sha256").matches("[0-9a-f]{64}")
                ||!string(value,"browser_part_set_sha256").matches("[0-9a-f]{64}"))throw invalid();
            String created=string(value,"created_at");
            if(!created.equals(VaultTimestamps.fromEpochMillisExact(VaultTimestamps.epochMillis(created,FAILURE))))throw invalid();
            for(String name:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(value.get(name)))throw invalid();
        }finally{Arrays.fill(bytes,(byte)0);}
    }

    /** Fixed synchronous IO composition. Stamps are expected original DATA,
     * never successful-currentness caches; each use reopens actual identities.
     */
    private final class Access {
        final VaultEngine.NativeOriginalInventoryAckIntentControl control;
        Access(VaultEngine.NativeOriginalInventoryAckIntentControl control){this.control=control;}
        void check()throws VaultFailure{if(refused)throw invalid();control.requireCurrent();}
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
