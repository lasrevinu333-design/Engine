package org.memphiszoo.custodial.vault;

import java.io.File;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.PosixFileAttributes;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Set;
import org.json.JSONObject;

/** UNMOUNTED fixed app-private ciphertext custody adapter. Android factory
 * is the sole product caller and supplies native no-backup root, never a
 * WebView path. This new protected domain is explicitly separate from the
 * original eight maps. No credentials/keys, raw/ciphertext getter, callbacks,
 * network, automatic recovery-by-encryption, accepted work, ACK or retirement.
 * File/dir force + exact readback are observations, NOT Android power-loss,
 * all-writer/ABA, application semantics or release recovery qualification.
 */
final class NativePrivateCapsuleFileStore {
    static final String DIRECTORY="custodial-private-eight-custody-v1";
    static final String COMMITTED="capsule.bin",PENDING="capsule.pending",LOCK="custody.lock";
    static final String FAILURE="custodial_native_private_capsule_file_store_unknown";
    static final Set<String> ARTIFACTS=Set.of(COMMITTED,PENDING,LOCK);
    /* Fixed capsule file I/O only, private to this adapter and its Target. */
    private interface CapsuleIo {void forceFile(FileChannel original)throws Exception;void linkPending()throws Exception;}
    private final CapsuleIo normalCapsuleIo=new CapsuleIo() {
        public void forceFile(FileChannel original)throws Exception {original.force(true);}
        public void linkPending()throws Exception {Files.createLink(committed,pending);}
    };
    private CapsuleIo capsuleIo=normalCapsuleIo;
    private final Path root,directory,committed,pending,lock;
    private NativePrivateCapsuleFileStore(File nativeNoBackupRoot)throws VaultFailure {
        try {
            if(nativeNoBackupRoot==null||!nativeNoBackupRoot.isAbsolute()
                ||!nativeNoBackupRoot.getAbsoluteFile().equals(nativeNoBackupRoot.getCanonicalFile()))throw invalid();
            root=nativeNoBackupRoot.toPath();requireDirectory(root);directory=root.resolve(DIRECTORY);
            committed=directory.resolve(COMMITTED);pending=directory.resolve(PENDING);lock=directory.resolve(LOCK);
        }catch(Exception e){throw invalid(e);}
    }
    /** Native Context factory binding ONLY. Package scope is for closed native
     * composition and synthetic owned-host fixtures, not employee input. */
    static NativePrivateCapsuleFileStore fromNativeNoBackupRoot(File nativeRoot)throws VaultFailure{return new NativePrivateCapsuleFileStore(nativeRoot);}
    /** Closed FIRST-original composition only. Source is this store's actual
     * private final root, not a path/identity supplied by the calling page or
     * copied from a frame projection. Equal ciphertext in another root cannot
     * satisfy the owning absence reservation. No bytes/capability are returned. */
    void requireSameNativeRoot(NativePrivateCustodyOperationStore.InitialMutationBaselineAbsence reservation)throws VaultFailure {
        try {
            if(reservation==null)throw invalid();requireDirectory(root);
            var before=Files.readAttributes(root,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            if(before.fileKey()==null)throw invalid();
            reservation.requireSameNativeRoot(root,before.fileKey());
            requireDirectory(root);var after=Files.readAttributes(root,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            if(!before.fileKey().equals(after.fileKey()))throw invalid();
            reservation.requireSameNativeRoot(root,after.fileKey());
        }catch(VaultFailure refused){throw refused;}catch(Exception unavailable){throw invalid(unavailable);}
    }
    static final class Existing implements AutoCloseable {
        final String phase;
        private final NativePrivateCapsuleFileStore owner;
        private final SourceIdentity source;
        private final NativeRetainedNamespacePrivateCapsule.SavedLocalRecord record;
        private volatile boolean closed,refused;
        private Existing(NativePrivateCapsuleFileStore owner,String phase,NativeRetainedNamespacePrivateCapsule.SavedLocalRecord record,SourceIdentity source){
            this.owner=owner;this.phase=phase;this.record=record;this.source=source;
        }
        private void requireCurrent()throws VaultFailure {
            try{if(closed||refused||!source.same(owner.captureSourceIdentity()))throw invalid();}
            catch(Exception unavailable){refused=true;throw invalid(unavailable);}
        }
        NativeRetainedNamespacePrivateCapsule.SavedLocalRecord originalEncryptedRecord()throws VaultFailure{requireCurrent();if(record==null)throw invalid();record.metadata();return record;}
        /** Internal observation comparison only; never absence or ACK authority. */
        boolean hasOriginalEncryptedRecord(){return record!=null;}
        boolean sameFixedObservation(Existing other)throws VaultFailure{
            requireCurrent();if(other!=null)other.requireCurrent();
            if(other==null||!phase.equals(other.phase)||(record==null)!=(other.record==null))return false;
            if(!source.same(other.source))return false;
            return record==null||record.sameOriginalEncryptedRecord(other.record);
        }
        JSONObject metadata()throws VaultFailure{
            try{requireCurrent();return new JSONObject().put("schema","custodial.native-private-capsule-file-observation.v1").put("phase",phase)
                .put("protected_storage_domain",DIRECTORY).put("key_family",NativeProtectedNamespaceObservation.SHARED_KEY)
                .put("fixed_artifact_names",new org.json.JSONArray().put(COMMITTED).put(PENDING).put(LOCK))
                .put("additional_protected_storage_declared",true).put("all_native_storage_inventory_complete",false)
                .put("record",record==null?JSONObject.NULL:record.metadata()).put("actual_Android_storage_qualified",false)
                .put("durable_retention",false).put("complete_namespace_inventory",false).put("all_writer_durable_freeze_or_ABA_guard",false)
                .put("current_server_readback",false).put("work_accepted",false).put("inventory_acknowledged",false)
                .put("resend_allowed",false).put("finalizer_allowed",false).put("key_removal",false);}
            catch(Exception e){throw invalid(e);}
        }
        @Override public void close(){closed=true;if(record!=null)record.close();}
    }
    /** Private process observation only. No JSON/getter, durable ABA claim or
     * authority. Directory/root mtimes are deliberately not pinned: another
     * declared private domain can be created without replacing these inodes. */
    private static final class SourceIdentity {
        private final Path root;
        private final Object rootKey,directoryKey;
        private final BasicFileAttributes lock,committed,pending;
        private SourceIdentity(Path root,Object rootKey,Object directoryKey,BasicFileAttributes lock,
            BasicFileAttributes committed,BasicFileAttributes pending){
            this.root=root;this.rootKey=rootKey;this.directoryKey=directoryKey;
            this.lock=lock;this.committed=committed;this.pending=pending;
        }
        private boolean same(SourceIdentity other){return other!=null&&root.equals(other.root)&&rootKey.equals(other.rootKey)
            &&java.util.Objects.equals(directoryKey,other.directoryKey)&&sameFile(lock,other.lock)
            &&sameFile(committed,other.committed)&&sameFile(pending,other.pending);}
        private static boolean sameFile(BasicFileAttributes a,BasicFileAttributes b){
            return a==null||b==null?a==b:a.fileKey().equals(b.fileKey())&&a.size()==b.size()&&a.lastModifiedTime().equals(b.lastModifiedTime());
        }
    }
    private static Object sourceKey(BasicFileAttributes attributes)throws VaultFailure {
        Object key=attributes.fileKey();if(key==null)throw invalid();return key;
    }
    private static BasicFileAttributes attributesOrAbsent(Path path)throws Exception {
        try{return Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);}
        catch(java.nio.file.NoSuchFileException absent){return null;}
    }
    private BasicFileAttributes sourceFile(Path path)throws Exception {
        if(attributesOrAbsent(path)==null)return null;
        BasicFileAttributes attributes=requirePrivateFile(path);sourceKey(attributes);return attributes;
    }
    private SourceIdentity captureSourceIdentity()throws Exception {
        requireDirectory(root);Object rootKey=sourceKey(Files.readAttributes(root,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS));
        BasicFileAttributes directoryAttributes=attributesOrAbsent(directory);
        Object directoryKey=null;BasicFileAttributes lockAttributes=null,committedAttributes=null,pendingAttributes=null;
        if(directoryAttributes!=null){
            requireStoreDirectory();directoryKey=sourceKey(directoryAttributes);requireLockFile();
            lockAttributes=sourceFile(lock);if(lockAttributes==null||lockAttributes.size()!=0)throw invalid();
            committedAttributes=sourceFile(committed);pendingAttributes=sourceFile(pending);
            requireStoreDirectory();
            if(!directoryKey.equals(sourceKey(Files.readAttributes(directory,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS))))throw invalid();
        }
        requireDirectory(root);
        if(!rootKey.equals(sourceKey(Files.readAttributes(root,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS))))throw invalid();
        return new SourceIdentity(root,rootKey,directoryKey,lockAttributes,committedAttributes,pendingAttributes);
    }
    private Existing capturedExisting(String phase,NativeRetainedNamespacePrivateCapsule.SavedLocalRecord record,SourceIdentity before)throws Exception {
        try{if(!before.same(captureSourceIdentity()))throw invalid();return new Existing(this,phase,record,before);}
        catch(Exception unavailable){if(record!=null)record.close();throw unavailable;}
    }
    private Existing readCapturedCommitted(String phase)throws Exception {
        SourceIdentity before=captureSourceIdentity();return capturedExisting(phase,readRecord(committed),before);
    }
    /** Concrete one-shot fixed native file target; private constructor, no
     * stream/path getter or external destination/callback. Only an opaque
     * saved record may use this internal writer while the lock is held. */
    static final class Target {
        private final FileChannel channel;private final CapsuleIo io;private final int expectedBytes;private final String expectedSha256;
        private final NativeRetainedNamespacePrivateCapsule capsule;
        private final VaultEngine.NativePrivateCapsuleRetentionControl control;
        private boolean active=true,written;
        private Target(FileChannel channel,JSONObject expected,CapsuleIo io,NativeRetainedNamespacePrivateCapsule capsule,
            VaultEngine.NativePrivateCapsuleRetentionControl control)throws Exception{
            this.channel=channel;this.io=io;expectedBytes=expected.getInt("record_bytes");expectedSha256=expected.getString("record_sha256");
            this.capsule=capsule;this.control=control;
        }
        void writeOriginalEncryptedRecord(byte[] original,String sha256)throws VaultFailure {
            try {
                if(!active||written||original==null||original.length!=expectedBytes||!expectedSha256.equals(sha256)||!sha256.equals(hash(original)))throw invalid();
                requireRetentionCurrent(capsule,control);written=true;long started=System.nanoTime();ByteBuffer bytes=ByteBuffer.wrap(original);
                while(bytes.hasRemaining()){if(System.nanoTime()-started>30_000_000_000L)throw invalid();if(channel.write(bytes)<=0)throw invalid();}
                requireRetentionCurrent(capsule,control);io.forceFile(channel);requireRetentionCurrent(capsule,control);
            }catch(Exception e){throw invalid(e);}
        }
    }
    Existing inspectExisting()throws VaultFailure {
        try {
            SourceIdentity before=captureSourceIdentity();if(before.directoryKey==null)return capturedExisting("ABSENT_NO_STORAGE_CREATED",null,before);
            requireStoreDirectory();requireLockFile();
            try(FileChannel held=openLock();FileLock ownership=held.tryLock()){
                if(ownership==null||!before.same(captureSourceIdentity()))throw invalid();return readCurrentUnderLock(before);
            }
        }catch(Exception e){throw invalid(e);}
    }
    /** Fixed read-only finalization-restart comparison, never promotion or
     * decryption authority. The real installed held owner binds this root;
     * the authenticated existing intent selects the exact original record.
     * Opaque matching ciphertext is not a full fresh capsule AEAD proof. */
    void requireOriginalFinalizationRecord(VaultEngine.NativeOriginalInventoryFinalizationRestoredRead original)throws VaultFailure {
        if(original==null)throw invalid();
        try{
            original.requireCurrent();
            try(var current=inspectExisting()){
                if(!"OPAQUE_COMMITTED_REQUIRES_ORIGINAL_RECOVERY".equals(current.phase)||!current.hasOriginalEncryptedRecord())throw invalid();
                String digest=current.originalEncryptedRecord().metadata().getString("record_sha256");
                original.requireCapsuleRecord(root.toFile(),digest);current.metadata();original.requireCurrent();
            }
        }catch(VaultFailure failure){throw failure;}catch(Exception failure){throw invalid(failure);}
    }
    /** Conditional exact-byte local retention/promotion ONLY. Production
     * caller must validate current original actor/all8 + fixed existing key
     * before/after this adapter. No missing/corrupt record is overwritten;
     * valid saved recovery uses the SAME IV/ciphertext, never a fresh capsule.
     * Fresh originals use CREATE_NEW on the fixed committed file under the
     * same control/lock, followed by force and exact readback. This is not
     * atomic complete publication or power-loss/custody authority; a failure
     * retains any partial file and never falls back to another publication.
     * Normal pending promotion reserves the absent fixed target CREATE_NEW,
     * then atomically moves the SAME pending inode over only that owned empty
     * reservation. Unknown targets/partial reservations are never adopted.
     * The private injected host fault path retains legacy absent-only linking;
     * existing SAME-inode alias cleanup remains separate and unchanged.
     */
    Existing retainExactOriginal(NativeRetainedNamespacePrivateCapsule capsule)throws VaultFailure {
        // Retain the old signature only to refuse it before any storage I/O.
        // A valid encrypted record is DATA, not a live Engine writer control;
        // historical format fixtures cannot be a shipping bypass around it.
        throw invalid();
    }
    Existing retainExactOriginal(NativeRetainedNamespacePrivateCapsule capsule,
        VaultEngine.NativePrivateCapsuleRetentionControl control)throws VaultFailure {
        if(control==null)throw invalid();
        return retainOriginalUnderControl(capsule,control);
    }
    private static void requireRetentionCurrent(NativeRetainedNamespacePrivateCapsule capsule,
        VaultEngine.NativePrivateCapsuleRetentionControl control)throws VaultFailure {
        if(capsule==null||control==null)throw invalid();
        control.requireCurrent(capsule);
    }
    private Existing retainedReadback(String phase,NativeRetainedNamespacePrivateCapsule capsule,
        VaultEngine.NativePrivateCapsuleRetentionControl control)throws Exception {
        requireRetentionCurrent(capsule,control);Existing result=readCapturedCommitted(phase);
        try{requireRetentionCurrent(capsule,control);return result;}
        catch(Exception refused){result.close();throw refused;}
    }
    private Existing retainOriginalUnderControl(NativeRetainedNamespacePrivateCapsule capsule,
        VaultEngine.NativePrivateCapsuleRetentionControl control)throws VaultFailure {
        if(capsule==null)throw invalid();
        // Choose the normal protocol BEFORE I/O, never after a link failure.
        final boolean normalPendingPublication=capsuleIo==normalCapsuleIo;
        requireRetentionCurrent(capsule,control);
        try(var candidate=capsule.savedLocalRecord()){
            requireRetentionCurrent(capsule,control);ensureStoreDirectory(capsule,control);requireRetentionCurrent(capsule,control);
            SourceIdentity pendingSourceBeforeLock=null;
            if(normalPendingPublication&&exists(pending)&&!exists(committed)){
                requireRetentionCurrent(capsule,control);pendingSourceBeforeLock=captureSourceIdentity();requireRetentionCurrent(capsule,control);
            }
            try(FileChannel held=openLock();FileLock ownership=held.tryLock()){
                if(ownership==null)throw invalid();requireStoreDirectory();requireRetentionCurrent(capsule,control);
                boolean hasCommitted=exists(committed),hasPending=exists(pending);
                if(hasCommitted){
                    if(hasPending&&!Files.isSameFile(committed,pending))throw invalid();
                    requireExact(committed,candidate);if(hasPending){requireExact(pending,candidate);
                        forceExactOriginal(committed,candidate,capsule,control);removeExactPendingAlias(candidate,capsule,control);}
                    return retainedReadback("EXACT_EXISTING_COMMITTED_RECORD_OBSERVED",capsule,control);
                }
                if(hasPending){requireExact(pending,candidate);forceExactOriginal(pending,candidate,capsule,control);}
                else {
                    requireRetentionCurrent(capsule,control);if(exists(pending))throw invalid();
                    try(FileChannel output=FileChannel.open(committed,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
                        PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
                        Target target=new Target(output,candidate.metadata(),capsuleIo,capsule,control);try{candidate.writeToFixedNativeTarget(target);}finally{target.active=false;}
                    }
                    requireRetentionCurrent(capsule,control);forceDirectory(capsule,control);requireStoreDirectory();
                    if(exists(pending))throw invalid();
                    requireExact(committed,candidate);requireRetentionCurrent(capsule,control);
                    return retainedReadback("EXACT_NEW_ENCRYPTED_RECORD_COMMITTED_OBSERVED",capsule,control);
                }
                forceDirectory(capsule,control);requireStoreDirectory();if(exists(committed))throw invalid();
                if(normalPendingPublication){
                    try(var publication=new PendingPublication(candidate,capsule,control,held,ownership,pendingSourceBeforeLock)){
                        FileChannel reserved=publication.reserveDestination();
                        publication.requireReservedDestination(reserved);
                        Files.move(pending,committed,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
                        publication.requirePublishedOriginal(reserved);
                    }
                    requireRetentionCurrent(capsule,control);forceDirectory(capsule,control);requireStoreDirectory();
                    if(exists(pending))throw invalid();
                    requireExact(committed,candidate);requireRetentionCurrent(capsule,control);
                    return retainedReadback("EXACT_ORIGINAL_PENDING_PROMOTED_OBSERVED",capsule,control);
                }
                requireRetentionCurrent(capsule,control);capsuleIo.linkPending();requireRetentionCurrent(capsule,control);
                forceDirectory(capsule,control);requireExact(committed,candidate);requireRetentionCurrent(capsule,control);
                removeExactPendingAlias(candidate,capsule,control);requireExact(committed,candidate);requireRetentionCurrent(capsule,control);
                return retainedReadback(hasPending?"EXACT_ORIGINAL_PENDING_PROMOTED_OBSERVED":"EXACT_NEW_ENCRYPTED_RECORD_COMMITTED_OBSERVED",capsule,control);
            }
        }catch(Exception e){throw invalid(e);}
    }
    /** Private SAME-invocation pending publication, not a path/permission API.
     * The actual creator owns its empty target and closes only that channel.
     * Every failure retains all names/bytes; no deletion, adoption or retry. */
    private final class PendingPublication implements AutoCloseable {
        private final NativeRetainedNamespacePrivateCapsule.SavedLocalRecord candidate;
        private final NativeRetainedNamespacePrivateCapsule capsule;
        private final VaultEngine.NativePrivateCapsuleRetentionControl control;
        private final FileChannel channel;
        private final FileLock ownership;
        private final Thread thread=Thread.currentThread();
        private final SourceIdentity original;
        private final PosixFileAttributes rootAttributes,directoryAttributes,lockAttributes,pendingAttributes;
        private FileChannel reservation;
        private PosixFileAttributes reservedAttributes;
        private boolean attempted,published,closed;
        private PendingPublication(NativeRetainedNamespacePrivateCapsule.SavedLocalRecord candidate,
            NativeRetainedNamespacePrivateCapsule capsule,VaultEngine.NativePrivateCapsuleRetentionControl control,
            FileChannel channel,FileLock ownership,SourceIdentity beforeLock)throws Exception {
            this.candidate=candidate;this.capsule=capsule;this.control=control;
            this.channel=channel;this.ownership=ownership;original=beforeLock;
            requireContext();
            if(original.pending==null||original.committed!=null||!original.same(captureSourceIdentity()))throw invalid();
            rootAttributes=posix(root);directoryAttributes=posix(directory);lockAttributes=posix(lock);pendingAttributes=posix(pending);
            requireContext();requireLineage();requirePendingOriginal();
            if(exists(committed))throw invalid();
        }
        private PosixFileAttributes posix(Path path)throws Exception {
            requireContext();var result=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            sourceKey(result);requireContext();return result;
        }
        private void requireContext()throws Exception {
            if(closed||Thread.currentThread()!=thread||capsuleIo!=normalCapsuleIo||original==null
                ||channel==null||!channel.isOpen()||ownership==null||!ownership.isValid()||ownership.channel()!=channel)throw invalid();
            requireRetentionCurrent(capsule,control);
            SourceIdentity now=captureSourceIdentity();
            if(!original.rootKey.equals(now.rootKey)||!java.util.Objects.equals(original.directoryKey,now.directoryKey)
                ||original.directoryKey==null||original.lock==null||!SourceIdentity.sameFile(original.lock,now.lock))throw invalid();
            requireRetentionCurrent(capsule,control);
        }
        private void requireOwnership(Path path,PosixFileAttributes expected)throws Exception {
            var actual=posix(path);
            if(!expected.fileKey().equals(actual.fileKey())||!expected.owner().equals(actual.owner())
                ||!expected.group().equals(actual.group())||!expected.permissions().equals(actual.permissions()))throw invalid();
        }
        private void requireLineage()throws Exception {
            requireContext();requireOwnership(root,rootAttributes);requireOwnership(directory,directoryAttributes);requireOwnership(lock,lockAttributes);
            requireLockFile();requireContext();
        }
        private void requirePendingOriginal()throws Exception {
            requireLineage();requireSameOriginalFile(pending,original.pending);requireOwnership(pending,pendingAttributes);
            if(original.pending.fileKey().equals(original.lock.fileKey()))throw invalid();
            requireExact(pending,candidate);requireContext();requireSameOriginalFile(pending,original.pending);
        }
        private FileChannel reserveDestination()throws Exception {
            requirePendingOriginal();if(attempted||published||exists(committed))throw invalid();attempted=true;
            requireContext();
            reservation=FileChannel.open(committed,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
                PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
            reservedAttributes=posix(committed);requireReservedDestination(reservation);return reservation;
        }
        private void requireEmptyReservation(FileChannel actual)throws Exception {
            if(!attempted||published||actual==null||actual!=reservation||!actual.isOpen()||reservedAttributes==null
                ||actual.size()!=0||actual.position()!=0||reservedAttributes.size()!=0)throw invalid();
            requirePrivateFile(committed);requireOwnership(committed,reservedAttributes);requireSameOriginalFile(committed,reservedAttributes);
            Object key=reservedAttributes.fileKey();
            if(key.equals(original.pending.fileKey())||key.equals(original.lock.fileKey())
                ||key.equals(original.rootKey)||key.equals(original.directoryKey))throw invalid();
            if(Files.isSameFile(committed,pending)||Files.isSameFile(committed,lock))throw invalid();
            requireContext();
        }
        private void requireReservedDestination(FileChannel actual)throws Exception {
            requirePendingOriginal();requireEmptyReservation(actual);
            requirePendingOriginal();requireEmptyReservation(actual);
            if(!ownership.isValid()||ownership.channel()!=channel||Thread.currentThread()!=thread)throw invalid();
            // No source/destination getter or intervening effect before move.
        }
        private void requirePublishedOriginal(FileChannel actual)throws Exception {
            requireLineage();
            if(!attempted||published||actual!=reservation||!actual.isOpen()||actual.size()!=0||reservedAttributes==null||exists(pending))throw invalid();
            requireSameOriginalFile(committed,original.pending);requireOwnership(committed,pendingAttributes);requireExact(committed,candidate);
            requireLineage();requireSameOriginalFile(committed,original.pending);
            if(exists(pending))throw invalid();requireRetentionCurrent(capsule,control);published=true;
        }
        @Override public void close()throws Exception {
            closed=true;if(reservation!=null)reservation.close();
            // Do not close the caller's lock/channel or unlink an unknown slot.
        }
    }
    private Existing readCurrentUnderLock(SourceIdentity before)throws Exception {
        requireStoreDirectory();boolean c=exists(committed),p=exists(pending);
        if(c&&p){if(!Files.isSameFile(committed,pending))throw invalid();
            try(var a=readRecord(committed);var b=readRecord(pending)){if(!a.sameOriginalEncryptedRecord(b))throw invalid();}
            return capturedExisting("OPAQUE_COMMITTED_WITH_SAME_INODE_PENDING_REQUIRES_ORIGINAL_RECOVERY",readRecord(committed),before);}
        if(c)return capturedExisting("OPAQUE_COMMITTED_REQUIRES_ORIGINAL_RECOVERY",readRecord(committed),before);
        if(p)return capturedExisting("OPAQUE_PENDING_REQUIRES_ORIGINAL_RECOVERY",readRecord(pending),before);
        return capturedExisting("ABSENT_FIXED_DIRECTORY_LOCK_ONLY",null,before);
    }
    private void ensureStoreDirectory(NativeRetainedNamespacePrivateCapsule capsule,VaultEngine.NativePrivateCapsuleRetentionControl control)throws Exception {
        requireRetentionCurrent(capsule,control);requireDirectory(root);
        if(!exists(directory)){Files.createDirectory(directory,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));requireRetentionCurrent(capsule,control);forceParent(capsule,control);}
        requireStoreDirectory();
        if(!exists(lock)){requireRetentionCurrent(capsule,control);try(FileChannel created=FileChannel.open(lock,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){requireRetentionCurrent(capsule,control);created.force(true);requireRetentionCurrent(capsule,control);}forceDirectory(capsule,control);}
        requireLockFile();requireRetentionCurrent(capsule,control);
    }
    private FileChannel openLock()throws Exception{requireLockFile();return FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);}
    private void requireLockFile()throws Exception{BasicFileAttributes attrs=requirePrivateFile(lock);if(attrs.size()!=0)throw invalid();}
    private void requireStoreDirectory()throws Exception {
        requireDirectory(directory);if(!Files.getPosixFilePermissions(directory,LinkOption.NOFOLLOW_LINKS).equals(PosixFilePermissions.fromString("rwx------")))throw invalid();
        try(var paths=Files.newDirectoryStream(directory)){for(Path p:paths)if(!ARTIFACTS.contains(p.getFileName().toString()))throw invalid();}
        for(Path p:new Path[]{committed,pending,lock})if(exists(p))requirePrivateFile(p);
    }
    private static void requireDirectory(Path p)throws Exception {
        BasicFileAttributes attrs=Files.readAttributes(p,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!attrs.isDirectory()||attrs.isSymbolicLink()||!p.toFile().getAbsoluteFile().equals(p.toFile().getCanonicalFile()))throw invalid();
    }
    private static BasicFileAttributes requirePrivateFile(Path p)throws Exception {
        BasicFileAttributes attrs=Files.readAttributes(p,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!attrs.isRegularFile()||attrs.isSymbolicLink()||!Files.getPosixFilePermissions(p,LinkOption.NOFOLLOW_LINKS).equals(PosixFilePermissions.fromString("rw-------")))throw invalid();return attrs;
    }
    private NativeRetainedNamespacePrivateCapsule.SavedLocalRecord readRecord(Path p)throws Exception {
        BasicFileAttributes before=requirePrivateFile(p);long size=before.size();if(size<64||size>NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.MAX_BYTES)throw invalid();
        byte[] bytes=new byte[(int)size];
        try(FileChannel input=FileChannel.open(p,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            if(input.size()!=size)throw invalid();long started=System.nanoTime();ByteBuffer buffer=ByteBuffer.wrap(bytes);
            while(buffer.hasRemaining()){if(System.nanoTime()-started>30_000_000_000L)throw invalid();if(input.read(buffer)<=0)throw invalid();}
            if(input.read(ByteBuffer.allocate(1))!=-1)throw invalid();BasicFileAttributes after=requirePrivateFile(p);
            if(!java.util.Objects.equals(before.fileKey(),after.fileKey())||before.size()!=after.size()||!before.lastModifiedTime().equals(after.lastModifiedTime()))throw invalid();
            return NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(bytes);
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    private void requireExact(Path p,NativeRetainedNamespacePrivateCapsule.SavedLocalRecord candidate)throws Exception{
        try(var existing=readRecord(p)){if(!candidate.sameOriginalEncryptedRecord(existing))throw invalid();}
    }
    /** A readable recovered record is not evidence of a successful prior force.
     * Force the SAME authenticated candidate/inode before promotion or cleanup,
     * then check it again; never rewrite or re-encrypt an ambiguous original. */
    private void forceExactOriginal(Path p,NativeRetainedNamespacePrivateCapsule.SavedLocalRecord candidate,
        NativeRetainedNamespacePrivateCapsule capsule,VaultEngine.NativePrivateCapsuleRetentionControl control)throws Exception {
        requireRetentionCurrent(capsule,control);requireExact(p,candidate);BasicFileAttributes before=requirePrivateFile(p);
        if(before.fileKey()==null)throw invalid();
        try(FileChannel original=FileChannel.open(p,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
            requireRetentionCurrent(capsule,control);capsuleIo.forceFile(original);requireRetentionCurrent(capsule,control);
        }
        requireRetentionCurrent(capsule,control);requireSameOriginalFile(p,before);forceDirectory(capsule,control);requireStoreDirectory();requireSameOriginalFile(p,before);
        requireExact(p,candidate);requireRetentionCurrent(capsule,control);
    }
    private void requireSameOriginalFile(Path p,BasicFileAttributes before)throws Exception {
        BasicFileAttributes after=requirePrivateFile(p);
        if(!before.fileKey().equals(after.fileKey())||before.size()!=after.size()||!before.lastModifiedTime().equals(after.lastModifiedTime()))throw invalid();
    }
    private void removeExactPendingAlias(NativeRetainedNamespacePrivateCapsule.SavedLocalRecord candidate,
        NativeRetainedNamespacePrivateCapsule capsule,VaultEngine.NativePrivateCapsuleRetentionControl control)throws Exception {
        requireRetentionCurrent(capsule,control);
        requireStoreDirectory();if(!exists(committed)||!exists(pending)||!Files.isSameFile(committed,pending))throw invalid();
        requireExact(committed,candidate);requireExact(pending,candidate);requireRetentionCurrent(capsule,control);
        Files.delete(pending);requireRetentionCurrent(capsule,control);forceDirectory(capsule,control);
    }
    private void forceParent(NativeRetainedNamespacePrivateCapsule capsule,VaultEngine.NativePrivateCapsuleRetentionControl control)throws Exception{
        requireRetentionCurrent(capsule,control);try(FileChannel dir=FileChannel.open(root,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            requireRetentionCurrent(capsule,control);dir.force(true);requireRetentionCurrent(capsule,control);
        }requireRetentionCurrent(capsule,control);
    }
    private void forceDirectory(NativeRetainedNamespacePrivateCapsule capsule,VaultEngine.NativePrivateCapsuleRetentionControl control)throws Exception{
        requireRetentionCurrent(capsule,control);requireDirectory(directory);try(FileChannel dir=FileChannel.open(directory,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            requireRetentionCurrent(capsule,control);dir.force(true);requireRetentionCurrent(capsule,control);
        }requireRetentionCurrent(capsule,control);
    }
    private static boolean exists(Path p)throws java.io.IOException {
        try{Files.readAttributes(p,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);return true;}
        catch(java.nio.file.NoSuchFileException absent){return false;}
    }
    private static String hash(byte[] value)throws Exception {StringBuilder out=new StringBuilder(64);for(byte b:MessageDigest.getInstance("SHA-256").digest(value)){
        out.append(Character.forDigit((b&255)>>>4,16)).append(Character.forDigit(b&15,16));}return out.toString();}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
    private static VaultFailure invalid(Throwable cause){
        // Keep the original owning failure/stack when its outward contract is
        // already exact; otherwise retain it beneath the existing fixed code.
        // No native detail is copied into public code/status/reason or logs.
        if(cause instanceof VaultFailure){VaultFailure failure=(VaultFailure)cause;
            if(FAILURE.equals(failure.code)&&failure.httpStatus==0&&"".equals(failure.remoteReason))return failure;}
        return new VaultFailure(FAILURE,cause);
    }
}
