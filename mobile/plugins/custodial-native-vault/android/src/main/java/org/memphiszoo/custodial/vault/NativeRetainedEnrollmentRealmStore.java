package org.memphiszoo.custodial.vault;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONObject;

/** Disk primitive for retained enrollment partitions. This is not inventory,
 * manager, work-acceptance or key-removal authority. Its mounted writer must
 * first prove the actual retained native/browser finalization control.
 * Existing roots, records, preference files and keys are never removed.
 */
final class NativeRetainedEnrollmentRealmStore {
    static final String LEGACY="legacy";
    static final String DIRECTORY="custodial-retained-enrollment-realms-v1";
    static final String AAD="org.memphiszoo.custodial.retained-enrollment-realms.v1";
    static final String FAILURE="custodial_retained_enrollment_realm_unavailable";
    static final String RESERVATION_HELD="custodial_retained_enrollment_reservation_unverified";
    private static final String SCHEMA="custodial.retained-enrollment-realm.v1";
    private static final int MAX=4*1024*1024;
    private static final int ENVELOPE_MAGIC=0x4d5a5231;
    private static final Map<Path,Object> PROCESS_LOCKS=new ConcurrentHashMap<>();
    private final Path root,directory,current,pending,reservation,reservationStage,lock,realms;
    private final Object rootKey,directoryKey,lockKey,realmsKey;
    private final UserPrincipal owner;
    private final CredentialCipher cipher;
    private final Object monitor;

    static final class State {
        final String realm,previousRealm,previousSha256,operationId,binding,sha256,rootIdentity;
        private State(String realm,String previousRealm,String previousSha256,String operationId,String binding,String sha256,String rootIdentity){
            this.realm=realm;this.previousRealm=previousRealm;this.previousSha256=previousSha256;this.operationId=operationId;
            this.binding=binding;this.sha256=sha256;this.rootIdentity=rootIdentity;
        }
    }
    /** Storage fixture seam only; a Path and Cipher cannot mint the mounted
     * Engine's private finalization control or change the current runtime. */
    NativeRetainedEnrollmentRealmStore(Path nativeNoBackupRoot,CredentialCipher existingKeyCipher)throws VaultFailure {
        this(nativeNoBackupRoot,existingKeyCipher,true);
    }
    NativeRetainedEnrollmentRealmStore(Path nativeNoBackupRoot,CredentialCipher existingKeyCipher,boolean initialize)throws VaultFailure {
        try{
            if(nativeNoBackupRoot==null||existingKeyCipher==null||!nativeNoBackupRoot.isAbsolute()
                ||!nativeNoBackupRoot.normalize().equals(nativeNoBackupRoot)
                ||!nativeNoBackupRoot.toRealPath().equals(nativeNoBackupRoot))throw unavailable();
            root=nativeNoBackupRoot;
            monitor=PROCESS_LOCKS.computeIfAbsent(root,ignored->new Object());
            synchronized(monitor){
                var a=directory(root);owner=a.owner();rootKey=a.fileKey();
                cipher=existingKeyCipher;directory=root.resolve(DIRECTORY);
                boolean existed=exists(directory);
                if(!initialize&&!existed)throw unavailable();
                ensureDirectory(directory);directoryKey=directory(directory).fileKey();
                realms=directory.resolve("realms");boolean bootstrap=!existed||emptyBootstrap(directory,realms);
                if(!exists(realms)&&!bootstrap)throw unavailable();
                ensureDirectory(realms);realmsKey=directory(realms).fileKey();
                current=directory.resolve("current.bin");
                pending=directory.resolve("prepared.bin");
                reservation=directory.resolve("reservation.bin");
                reservationStage=directory.resolve("reservation.bin.stage");
                lock=directory.resolve("owner.lock");
                if(!exists(lock)){
                    if(!bootstrap)throw unavailable();
                    // Only the lock inode matters. Never replace an active lock.
                    try{Files.createFile(lock,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));}
                    catch(FileAlreadyExistsException concurrent){regular(lock);}
                }
                lockKey=regular(lock).fileKey();requireBase();
                if(bootstrap){forceDirectory(directory);forceDirectory(root);}
            }
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }
    State read()throws VaultFailure {synchronized(monitor){
        try(FileChannel c=FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);FileLock held=c.lock()){
            requireBase();
            // An interrupted prepared transition has exactly one original
            // continuation. Ordinary startup must not invent a new partition.
            if(exists(reservationStage)||exists(pending)||exists(reservation))throw unavailable();
            return current();
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }}
    /** Complete only the already durable exact transition. No new manager
     * decision, UUID, encryption, root, old-state restoration or deletion. */
    State finishPrepared()throws VaultFailure {synchronized(monitor){
        try(FileChannel c=FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);FileLock held=c.lock()){
            requireBase();
            if(exists(reservationStage))publishReservationStage();
            if(exists(reservation))return finishReserved();
            if(!exists(pending))return current();
            byte[] bytes=readFile(pending);State prepared=decode(bytes);
            State before=currentForPrepared(prepared);
            if(before.realm.equals(prepared.realm)){
                if(!before.sha256.equals(prepared.sha256))throw unavailable();
            }else{
                JSONObject data=bindingEnvelope(bytes);
                if(!before.realm.equals(prepared.previousRealm)||!before.sha256.equals(data.getString("previous_sha256")))throw unavailable();
            }
            publishTransition(prepared,bytes);
            requireTransitionAndRoot(prepared,bytes);promotePrepared();return requireExact(prepared);
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }}
    State advance(State expected,String nextRealm,String operationId,String originalBinding)throws VaultFailure {synchronized(monitor){
        try(FileChannel c=FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);FileLock held=c.lock()){
            requireBase();if(exists(reservationStage)||exists(pending)||exists(reservation)||expected==null)throw unavailable();
            State before=current();if(!before.realm.equals(expected.realm)||!before.sha256.equals(expected.sha256))throw unavailable();
            uuid(nextRealm);uuid(operationId);
            if(nextRealm.equals(before.realm)||originalBinding==null||originalBinding.isEmpty()
                ||originalBinding.getBytes(StandardCharsets.UTF_8).length>2*1024*1024)throw unavailable();
            // Existing roots still refuse before reservation. Only this exact
            // authenticated own allocation intent may later finish an empty
            // root it reserved. No arbitrary original root is adopted.
            if(exists(realms.resolve(nextRealm))||exists(transition(nextRealm)))throw unavailable();
            var intent=new JSONObject().put("schema","custodial.retained-enrollment-realm-reservation.v1")
                .put("realm",nextRealm).put("previous_realm",before.realm).put("previous_sha256",before.sha256)
                .put("operation_id",operationId).put("original_binding",originalBinding)
                .put("root_identity",rootKey.toString()).put("keep_all_original_work",true)
                .put("keep_all_existing_keys",true).put("work_accepted",false);
            createStage(reservationStage,encryptDocument(intent));
            publishReservationStage();
            return finishReserved();
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }}
    private JSONObject readReservation(Path path)throws Exception {
        JSONObject intent;
        try{intent=decryptDocument(readFile(path));}
        catch(Exception unreadable){throw new VaultFailure(RESERVATION_HELD,unreadable);}
        keys(intent,"schema","realm","previous_realm","previous_sha256","operation_id","original_binding","root_identity",
            "keep_all_original_work","keep_all_existing_keys","work_accepted");
        if(!"custodial.retained-enrollment-realm-reservation.v1".equals(intent.getString("schema")))throw unavailable();
        validateCommon(intent);return intent;
    }
    private void publishReservationStage()throws Exception {
        if(exists(reservation)||exists(pending))throw unavailable();
        JSONObject intent=readReservation(reservationStage);
        String next=intent.getString("realm");
        State before=current();
        if(!before.realm.equals(intent.getString("previous_realm"))||!before.sha256.equals(intent.getString("previous_sha256"))
            ||exists(realms.resolve(next))||exists(transition(next)))throw unavailable();
        // A complete file from an interrupted sync can still own the exact
        // reservation. Sync it again before making the final name visible.
        try(FileChannel c=FileChannel.open(reservationStage,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){c.force(true);}
        promoteNew(reservationStage,reservation);
    }
    private State finishReserved()throws Exception {
        JSONObject intent=readReservation(reservation);String next=intent.getString("realm");
        State before;
        if(!exists(current)&&LEGACY.equals(intent.getString("previous_realm"))){
            try(DirectoryStream<Path> entries=Files.newDirectoryStream(directory,"transition-*.bin")){
                for(Path entry:entries)if(!entry.equals(transition(next)))throw unavailable();
            }
            before=new State(LEGACY,"","","","","",rootKey.toString());
        }else before=current();
        if(before.realm.equals(next)){
            if(!matchesReservation(before,intent))throw unavailable();
            if(exists(pending)){
                byte[] bytes=readFile(pending);if(!before.sha256.equals(decode(bytes).sha256))throw unavailable();promotePrepared();
            }
            Files.delete(reservation);forceDirectory(directory);return requireExact(before);
        }
        if(!before.realm.equals(intent.getString("previous_realm"))||!before.sha256.equals(intent.getString("previous_sha256")))throw unavailable();
        // Old versions could leave final-name partial files. An authentic
        // reservation and its verified predecessor still own this transition.
        // Preserve a provably truncated prepared artifact before resuming.
        if(exists(pending)){
            byte[] staged=readFile(pending,true);
            if(truncatedEnvelope(staged)){
                requireEmptyReservedRoot(next);
                if(exists(transition(next)))throw unavailable();
                retainTruncated(pending);
            }
        }
        State after;byte[] bytes;
        if(exists(pending)){
            bytes=readFile(pending);after=decode(bytes);if(!matchesReservation(after,intent))throw unavailable();
        }else{
            if(exists(transition(next)))throw unavailable();
            Path nextRoot=realms.resolve(next);
            if(exists(nextRoot))requireEmptyReservedRoot(next);
            else ensureDirectory(nextRoot);
            forceDirectory(realms);
            JSONObject document=new JSONObject(intent.toString()).put("schema",SCHEMA)
                .put("new_root_identity",directory(nextRoot).fileKey().toString());
            bytes=encryptDocument(document);after=decode(bytes);
            publishNew(pending,bytes);
        }
        publishTransition(after,bytes);
        requireTransitionAndRoot(after,bytes);promotePrepared();State observed=requireExact(after);
        Files.delete(reservation);forceDirectory(directory);return observed;
    }
    private static boolean matchesReservation(State state,JSONObject intent)throws Exception {
        return state.realm.equals(intent.getString("realm"))&&state.previousRealm.equals(intent.getString("previous_realm"))
            &&state.previousSha256.equals(intent.getString("previous_sha256"))&&state.operationId.equals(intent.getString("operation_id"))
            &&state.binding.equals(intent.getString("original_binding"));
    }
    private void requireEmptyReservedRoot(String realm)throws Exception {
        Path path=realms.resolve(realm);
        if(!exists(path)||!directory(path).owner().equals(owner))throw unavailable();
        try(DirectoryStream<Path> entries=Files.newDirectoryStream(path)){if(entries.iterator().hasNext())throw unavailable();}
    }
    private void publishTransition(State state,byte[] exactBytes)throws Exception {
        requireRealmRoot(state);
        Path path=transition(state.realm);
        if(exists(path)){
            byte[] previous=readFile(path,true);
            if(Arrays.equals(previous,exactBytes))return;
            if(previous.length>=exactBytes.length||!Arrays.equals(previous,Arrays.copyOf(exactBytes,previous.length)))throw unavailable();
            retainTruncated(path);
        }
        publishNew(path,exactBytes);
    }
    private void retainTruncated(Path path)throws Exception {
        promoteNew(path,directory.resolve("retained-incomplete-"+UUID.randomUUID()+".evidence"));
    }
    private byte[] encryptDocument(JSONObject document)throws Exception {
        char[] clear=document.toString().toCharArray();try{return encode(cipher.encryptWithExistingKey(clear));}
        finally{Arrays.fill(clear,'\0');}
    }
    State retiredState(String realm)throws VaultFailure {synchronized(monitor){
        try{requireBase();uuid(realm);byte[] bytes=readFile(transition(realm));State state=decode(bytes);requireTransitionAndRoot(state,bytes);return state;}
        catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }}
    Path realmRoot(State state)throws VaultFailure {synchronized(monitor){
        try{requireBase();if(state==null)throw unavailable();
            if(LEGACY.equals(state.realm)){if(!state.sha256.isEmpty())throw unavailable();return root;}
            uuid(state.realm);byte[] bytes=readFile(transition(state.realm));State saved=decode(bytes);
            if(!saved.sha256.equals(state.sha256))throw unavailable();requireTransitionAndRoot(saved,bytes);
            return realms.resolve(saved.realm);
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }}
    private State currentForPrepared(State prepared)throws Exception {
        if(!exists(current)&&LEGACY.equals(prepared.previousRealm))
            return new State(LEGACY,"","","","","",rootKey.toString());
        return current();
    }
    private State current()throws Exception {
        requireBase();
        if(!exists(current)){
            // A missing pointer alongside any original transition is UNKNOWN.
            // The one legacy root is allowed only before the first transition.
            try(DirectoryStream<Path> entries=Files.newDirectoryStream(directory,"transition-*.bin")){
                if(entries.iterator().hasNext())throw unavailable();
            }
            return new State(LEGACY,"","","","","",rootKey.toString());
        }
        byte[] bytes=readFile(current);State state=decode(bytes);requireTransitionAndRoot(state,bytes);return state;
    }
    private State requireExact(State expected)throws Exception {
        State observed=current();if(!observed.sha256.equals(expected.sha256)||!observed.realm.equals(expected.realm))throw unavailable();
        requireBase();return observed;
    }
    private void requireTransitionAndRoot(State state,byte[] bytes)throws Exception {
        if(!Arrays.equals(bytes,readFile(transition(state.realm))))throw unavailable();
        requireRealmRoot(state);
    }
    private void requireRealmRoot(State state)throws Exception {
        var a=directory(realms.resolve(state.realm));if(!a.fileKey().toString().equals(state.rootIdentity)||!a.owner().equals(owner))throw unavailable();
        requireBase();
    }
    private Path transition(String realm)throws VaultFailure {uuid(realm);return directory.resolve("transition-"+realm+".bin");}
    private void promotePrepared()throws Exception {
        requireBase();readFile(pending);
        Files.move(pending,current,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
        forceDirectory(directory);requireBase();
    }
    private JSONObject decryptDocument(byte[] bytes)throws Exception {
        char[] clear=null;try{
            try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes))){
                if(in.readInt()!=ENVELOPE_MAGIC)throw unavailable();
                EncryptedSecret encrypted=new EncryptedSecret(readString(in),readString(in),MAX);
                if(in.available()!=0)throw unavailable();clear=cipher.decrypt(encrypted);
            }
            if(clear==null||clear.length==0||clear.length>MAX)throw unavailable();return new JSONObject(new String(clear));
        }finally{if(clear!=null)Arrays.fill(clear,'\0');}
    }
    private void validateCommon(JSONObject value)throws Exception {
        if(!rootKey.toString().equals(value.getString("root_identity"))
            ||!Boolean.TRUE.equals(value.get("keep_all_original_work"))||!Boolean.TRUE.equals(value.get("keep_all_existing_keys"))
            ||!Boolean.FALSE.equals(value.get("work_accepted")))throw unavailable();
        uuid(value.getString("realm"));uuid(value.getString("operation_id"));
        String previous=value.getString("previous_realm"),sha=value.getString("previous_sha256");
        if(LEGACY.equals(previous)){if(!sha.isEmpty())throw unavailable();}
        else{uuid(previous);if(!sha.matches("[a-f0-9]{64}"))throw unavailable();}
        if(previous.equals(value.getString("realm"))||value.getString("original_binding").isEmpty()
            ||value.getString("original_binding").getBytes(StandardCharsets.UTF_8).length>2*1024*1024)throw unavailable();
    }
    private JSONObject bindingEnvelope(byte[] bytes)throws Exception {
        JSONObject value=decryptDocument(bytes);
        keys(value,"schema","realm","previous_realm","previous_sha256","operation_id","original_binding","root_identity",
            "new_root_identity","keep_all_original_work","keep_all_existing_keys","work_accepted");
        if(!SCHEMA.equals(value.getString("schema"))||value.getString("new_root_identity").isEmpty())throw unavailable();
        validateCommon(value);return value;
    }
    private State decode(byte[] bytes)throws Exception {
        JSONObject value=bindingEnvelope(bytes);
        return new State(value.getString("realm"),value.getString("previous_realm"),value.getString("previous_sha256"),value.getString("operation_id"),
            value.getString("original_binding"),hex(MessageDigest.getInstance("SHA-256").digest(bytes)),value.getString("new_root_identity"));
    }
    private static void keys(JSONObject value,String... expected)throws VaultFailure {
        if(value.length()!=expected.length)throw unavailable();
        for(String key:expected)if(!value.has(key))throw unavailable();
    }
    private static byte[] encode(EncryptedSecret value)throws Exception {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(DataOutputStream out=new DataOutputStream(bytes)){
            out.writeInt(ENVELOPE_MAGIC);writeString(out,value.ciphertext);writeString(out,value.iv);
        }if(bytes.size()>MAX)throw unavailable();return bytes.toByteArray();
    }
    private static void writeString(DataOutputStream out,String value)throws Exception {byte[] bytes=value.getBytes(StandardCharsets.UTF_8);if(bytes.length<1||bytes.length>MAX)throw unavailable();out.writeInt(bytes.length);out.write(bytes);}
    private static String readString(DataInputStream in)throws Exception {int size=in.readInt();if(size<1||size>MAX||size>in.available())throw unavailable();byte[] bytes=new byte[size];in.readFully(bytes);return new String(bytes,StandardCharsets.UTF_8);}
    private static boolean truncatedEnvelope(byte[] bytes){
        ByteBuffer content=ByteBuffer.wrap(bytes);
        for(int shift=24;shift>=0;shift-=8){
            if(!content.hasRemaining())return true;
            if(content.get()!=(byte)(ENVELOPE_MAGIC>>>shift))return false;
        }
        for(int fields=0;fields<2;fields++){
            if(content.remaining()<Integer.BYTES)return true;
            int length=content.getInt();
            if(length<1||length>MAX)return false;
            if(length>content.remaining())return true;
            content.position(content.position()+length);
        }
        return false;
    }
    private byte[] readFile(Path path)throws Exception {return readFile(path,false);}
    private byte[] readFile(Path path,boolean allowEmpty)throws Exception {
        var before=regular(path);long size=before.size();if((!allowEmpty&&size==0)||size>MAX)throw unavailable();
        byte[] bytes=new byte[(int)size];try(FileChannel c=FileChannel.open(path,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            ByteBuffer buffer=ByteBuffer.wrap(bytes);while(buffer.hasRemaining())if(c.read(buffer)<0)throw unavailable();
            if(c.read(ByteBuffer.allocate(1))!=-1)throw unavailable();
        }var after=regular(path);if(!before.fileKey().equals(after.fileKey())||after.size()!=size)throw unavailable();return bytes;
    }
    private void createStage(Path path,byte[] bytes)throws Exception {
        try(FileChannel c=FileChannel.open(path,Set.of(StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
            if(path.equals(reservationStage))forceDirectory(directory);
            ByteBuffer buffer=ByteBuffer.wrap(bytes);while(buffer.hasRemaining())c.write(buffer);c.force(true);
        }regular(path);if(!Arrays.equals(bytes,readFile(path)))throw unavailable();
    }
    private void publishNew(Path path,byte[] bytes)throws Exception {
        Path stage=directory.resolve("write-"+UUID.randomUUID()+".staged");
        createStage(stage,bytes);
        promoteNew(stage,path);
    }
    private void promoteNew(Path source,Path destination)throws Exception {
        requireBase();regular(source);
        if(exists(destination))throw unavailable();
        Files.move(source,destination,StandardCopyOption.ATOMIC_MOVE);
        forceDirectory(directory);regular(destination);
    }
    private static boolean emptyBootstrap(Path dir,Path realms)throws Exception {
        try(DirectoryStream<Path> entries=Files.newDirectoryStream(dir)){
            for(Path entry:entries)if(!entry.equals(realms))return false;
        }
        if(exists(realms))try(DirectoryStream<Path> entries=Files.newDirectoryStream(realms)){
            if(entries.iterator().hasNext())return false;
        }
        return true;
    }
    private void ensureDirectory(Path path)throws Exception {
        if(!exists(path)){
            try{Files.createDirectory(path,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));}
            catch(FileAlreadyExistsException concurrent){directory(path);}
        }
        if(!directory(path).owner().equals(owner))throw unavailable();
    }
    private PosixFileAttributes regular(Path path)throws Exception {
        var a=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!a.isRegularFile()||a.fileKey()==null||!a.owner().equals(owner)
            ||((Number)Files.getAttribute(path,"unix:nlink",LinkOption.NOFOLLOW_LINKS)).longValue()!=1)throw unavailable();return a;
    }
    private static PosixFileAttributes directory(Path path)throws Exception {
        var a=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!a.isDirectory()||a.fileKey()==null)throw unavailable();return a;
    }
    private void requireBase()throws Exception {
        if(!rootKey.equals(directory(root).fileKey())||!owner.equals(directory(root).owner())
            ||!directoryKey.equals(directory(directory).fileKey())||!owner.equals(directory(directory).owner())
            ||!realmsKey.equals(directory(realms).fileKey())||!owner.equals(directory(realms).owner())
            ||!lockKey.equals(regular(lock).fileKey()))throw unavailable();
    }
    private static boolean exists(Path path){return Files.exists(path,LinkOption.NOFOLLOW_LINKS);}
    private static void forceDirectory(Path path)throws Exception {try(FileChannel c=FileChannel.open(path,StandardOpenOption.READ)){c.force(true);}}
    private static void uuid(String value)throws VaultFailure {if(value==null||!value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"))throw unavailable();}
    private static String hex(byte[] bytes){StringBuilder value=new StringBuilder();for(byte b:bytes)value.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return value.toString();}
    private static VaultFailure unavailable(){return new VaultFailure(FAILURE);}
}
