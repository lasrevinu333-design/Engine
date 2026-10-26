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
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** UNMOUNTED fixed EXTRA protected domain. A single immutable operation is
 * encrypted with the existing shared V2 key before any future dispatch. Only
 * a closed current original frame supplies its binding; callers cannot supply
 * IDs, plaintext, keys, ciphers, AAD, destination or recovery replacement.
 * A different/ambiguous record is preserved and refused. This is NOT all8
 * server custody, per-chunk identities, Android crash/power-loss qualification,
 * complete inventory, an ACK, resend, finalizer or key-retirement capability.
 */
final class NativePrivateCustodyOperationStore {
    static final String DIRECTORY="custodial-private-eight-custody-operation-v1";
    static final String COMMITTED="operation.bin",PENDING="operation.pending",LOCK="operation.lock";
    // A2/G04: v1 did not persist the captured attempted-write stamp. Its
    // encrypted originals are retained/refused, never implicitly upgraded.
    static final String SCHEMA="custodial.native-private-eight-custody-operation.v2";
    static final String AAD="org.memphiszoo.custodial.native-private-eight-custody-operation.v1";
    static final String FAILURE="custodial_native_private_custody_operation_unknown";
    static final int MAX_CLEAR=8192,MAX_RECORD=MAX_CLEAR+256,MAGIC=0x4d5a4f31;
    private static final Set<String> ARTIFACTS=Set.of(COMMITTED,PENDING,LOCK);
    /* Process-only original ownership, also shared by another adapter for this
     * exact native root. Never a durable observation or a restart recovery.
     * Fail-fast admission does not hold a monitor while re-entering Engine. */
    private static final ConcurrentHashMap<Path,PreparationState> PREPARATIONS=new ConcurrentHashMap<>();
    private static final class PreparationState {
        final AtomicBoolean active=new AtomicBoolean();PreparedOriginal original;
    }
    private static final class PreparedOriginal {
        final String binding,body;final Object rootKey,directoryKey,lockKey;Existing record;Object pendingKey;
        boolean directCreationUnobserved;
        PreparedOriginal(NativePrivateCustodyOperationStore owner,JSONObject binding,String body)throws Exception {
            this.binding=binding.toString();this.body=body;rootKey=directoryKey(owner.root);
            directoryKey=directoryKey(owner.directory);lockKey=fileKey(requirePrivateFile(owner.lock));
        }
        void requireContext(NativePrivateCustodyOperationStore owner,JSONObject binding)throws Exception {
            requireIdentities(owner);if(!this.binding.equals(binding.toString()))throw invalid();
        }
        void requireIdentities(NativePrivateCustodyOperationStore owner)throws Exception {
            if(directCreationUnobserved)throw invalid();
            requireDirectory(owner.root);owner.requireStoreDirectory();owner.requireLockFile();
            if(!rootKey.equals(directoryKey(owner.root))||!directoryKey.equals(directoryKey(owner.directory))
                ||!lockKey.equals(fileKey(requirePrivateFile(owner.lock))))throw invalid();
            if(pendingKey!=null) {
                Path saved=exists(owner.pending)?owner.pending:exists(owner.committed)?owner.committed:null;
                if(saved==null||!pendingKey.equals(fileKey(requirePrivateFile(saved))))throw invalid();
            }
        }
    }
    /* Fixed private I/O seam only. Normal construction always uses the actual
     * owned pending CREATE_NEW/write/force; no caller or plugin supplies it. */
    private interface PendingWriter {void write(Existing original)throws Exception;}
    private final PendingWriter normalPendingWriter=this::writePendingOriginal;
    private PendingWriter pendingWriter=normalPendingWriter;
    /* Fixed explicit-resume I/O only. Normal resume forces then moves the
     * existing inode over its owned empty reservation; the injected HOST seam
     * retains legacy link behavior. No callback/admission is exposed. */
    private interface ResumeIo {void forceOriginal()throws Exception;void linkPending()throws Exception;}
    private final ResumeIo normalResumeIo=new ResumeIo() {
        public void forceOriginal()throws Exception {forceKnownOriginal(exists(committed)?committed:pending);}
        public void linkPending()throws Exception {Files.createLink(committed,pending);}
    };
    private ResumeIo resumeIo=normalResumeIo;
    private final PreparationState preparation;
    private final Path root,directory,committed,pending,lock;
    private final AndroidKeystoreCipher cipher=new AndroidKeystoreCipher(AAD,MAX_CLEAR);
    private NativePrivateCustodyOperationStore(File nativeRoot)throws VaultFailure {
        try {if(nativeRoot==null||!nativeRoot.isAbsolute()||!nativeRoot.getAbsoluteFile().equals(nativeRoot.getCanonicalFile()))throw invalid();
            root=nativeRoot.toPath();requireDirectory(root);directory=root.resolve(DIRECTORY);committed=directory.resolve(COMMITTED);
            pending=directory.resolve(PENDING);lock=directory.resolve(LOCK);
            preparation=PREPARATIONS.computeIfAbsent(root,ignored->new PreparationState());
        }catch(Exception e){throw invalid();}
    }
    static NativePrivateCustodyOperationStore fromNativeNoBackupRoot(File nativeRoot)throws VaultFailure{return new NativePrivateCustodyOperationStore(nativeRoot);}
    /** Initial metadata installation ONLY. Presence of any private custody directory
     * (including unknown/partial/empty) is not absence and cannot be upgraded.
     * This source lease creates no file, UUID, ciphertext or generation. Main
     * must additionally hold the authenticated native owner/all8 prerequisite.
     * It is not an ACK or a cross-process/Android power-loss qualification. */
    final class InitialMutationBaselineAbsence implements AutoCloseable {
        private final Object originalRootKey;
        private volatile boolean closed,refused;
        private boolean transferring;
        private InitialMutationBaselineAbsence()throws Exception {
            originalRootKey=directoryKey(root);requireCurrent();
        }
        void requireCurrent()throws VaultFailure {
            try {
                if(closed||refused||!preparation.active.get()||preparation.original!=null
                    ||!originalRootKey.equals(directoryKey(root))||exists(directory)
                    ||exists(root.resolve(NativePrivateCapsuleFileStore.DIRECTORY))
                    ||exists(root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)))throw invalid();
                // Check the root on both sides of the exact no-follow absence
                // read. Denied/uninspectable paths are never treated as absent.
                if(!originalRootKey.equals(directoryKey(root)))throw invalid();
            }catch(Exception unavailable){refused=true;throw invalid();}
        }
        /** Called only by the closed frame's owning private capsule store.
         * Root equality is rejection-only, not caller/authentication authority.
         * Capsule creation is expected by this point, so absence is not reread. */
        void requireSameNativeRoot(Path capsuleRoot,Object capsuleRootKey)throws VaultFailure {
            try {
                if(closed||refused||!preparation.active.get()||preparation.original!=null
                    ||capsuleRoot==null||capsuleRootKey==null||!root.equals(capsuleRoot)
                    ||!originalRootKey.equals(directoryKey(root))||!originalRootKey.equals(capsuleRootKey))throw invalid();
                if(!originalRootKey.equals(directoryKey(root))||closed||refused
                    ||!preparation.active.get()||preparation.original!=null)throw invalid();
            }catch(Exception unavailable){refused=true;throw invalid();}
        }
        /** One-shot transfer of THIS still-owned absence reservation. Never
         * release/re-enter between owning capture and the original durable
         * preparation. Refusal/uncertainty consumes the lease but never clears
         * preparation.original or removes/replaces any retained file. */
        Existing retainFirstOriginal(VaultEngine.NativePrivateCustodyTransportFrame frame)throws VaultFailure {
            return retainFirstOriginalUnderControl(frame,null);
        }
        /** Shipping first-entry invocation: the original finite control is
         * required. Never fall back to the legacy fixture-only overload. */
        Existing retainFirstOriginal(VaultEngine.NativePrivateCustodyTransportFrame frame,
            NativePrivateCustodyFrameReadControl control)throws VaultFailure {
            if(control==null)throw invalid();
            return retainFirstOriginalUnderControl(frame,control);
        }
        private Existing retainFirstOriginalUnderControl(VaultEngine.NativePrivateCustodyTransportFrame frame,
            NativePrivateCustodyFrameReadControl control)throws VaultFailure {
            synchronized(this){if(closed||transferring)throw invalid();transferring=true;}
            Existing result=null;
            try {
                checkInvocation(control);
                if(refused||!preparation.active.get()||preparation.original!=null
                    ||!originalRootKey.equals(directoryKey(root))||exists(directory)
                    ||exists(root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)))throw invalid();
                Path capsule=root.resolve(NativePrivateCapsuleFileStore.DIRECTORY);
                if(!exists(capsule))throw invalid();requireDirectory(capsule);
                if(frame==null)throw invalid();frame.requireFirstOriginalReservation(this);frame.metadata();checkInvocation(control);
                if(!originalRootKey.equals(directoryKey(root))||exists(directory)
                    ||exists(root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)))throw invalid();
                result=prepareOriginalUnderReservation(frame,control);
                checkInvocation(control);frame.requireFirstOriginalReservation(this);frame.metadata();checkInvocation(control);
                Existing returned=result;result=null;return returned;
            }catch(Exception unavailable){refused=true;throw new VaultFailure(FAILURE,unavailable);}
            finally {
                if(result!=null)result.close();
                // No lease monitor is held across an Engine/file callback.
                // A reentrant close cannot release this active transfer; a
                // stale close cannot release a later same-root reservation.
                synchronized(this){closed=true;transferring=false;}
                leave();
            }
        }
        @Override public void close(){
            synchronized(this){if(closed||transferring)return;closed=true;}
            leave();
        }
    }
    InitialMutationBaselineAbsence acquireInitialMutationBaselineAbsence()throws VaultFailure {
        enter();boolean transferred=false;
        try{var lease=new InitialMutationBaselineAbsence();transferred=true;return lease;}
        catch(Exception unavailable){throw invalid();}
        finally{if(!transferred)leave();}
    }
    /** Private read provenance only. Volatile encrypted preparations have none.
     * The selected fixed name and both phase slots are pinned, including an
     * exact pending/committed alias. No caller can supply these identities. */
    private static final class ObservedIdentity {
        final Path root,directory,lock,record;final String phase;
        final Object rootKey,directoryKey,lockKey,recordKey,committedKey,pendingKey;
        final long recordBytes;final java.nio.file.attribute.FileTime recordModified;
        private ObservedIdentity(NativePrivateCustodyOperationStore owner,Path record,String phase)throws Exception {
            root=owner.root;directory=owner.directory;lock=owner.lock;this.record=record;this.phase=phase;
            rootKey=directoryKey(root);owner.requireStoreDirectory();directoryKey=directoryKey(directory);
            owner.requireLockFile();lockKey=fileKey(requirePrivateFile(lock));
            committedKey=exists(owner.committed)?fileKey(requirePrivateFile(owner.committed)):null;
            pendingKey=exists(owner.pending)?fileKey(requirePrivateFile(owner.pending)):null;
            if("COMMITTED".equals(phase)) {
                if(committedKey==null||pendingKey!=null||!record.equals(owner.committed))throw invalid();
            }else if("PENDING".equals(phase)) {
                if(committedKey!=null||pendingKey==null||!record.equals(owner.pending))throw invalid();
            }else if("COMMITTED_PENDING_ALIAS".equals(phase)) {
                if(committedKey==null||!committedKey.equals(pendingKey)
                    ||!Files.isSameFile(owner.committed,owner.pending)
                    ||(!record.equals(owner.committed)&&!record.equals(owner.pending)))throw invalid();
            }else throw invalid();
            BasicFileAttributes attributes=requirePrivateFile(record);recordKey=fileKey(attributes);
            if(!recordKey.equals(record.equals(owner.committed)?committedKey:pendingKey))throw invalid();
            recordBytes=attributes.size();recordModified=attributes.lastModifiedTime();
            if(!rootKey.equals(directoryKey(root))||!directoryKey.equals(directoryKey(directory))
                ||!lockKey.equals(fileKey(requirePrivateFile(lock))))throw invalid();
        }
        private boolean same(ObservedIdentity other) {
            return other!=null&&root.equals(other.root)&&directory.equals(other.directory)
                &&lock.equals(other.lock)&&record.equals(other.record)&&phase.equals(other.phase)
                &&rootKey.equals(other.rootKey)&&directoryKey.equals(other.directoryKey)
                &&lockKey.equals(other.lockKey)&&recordKey.equals(other.recordKey)
                &&java.util.Objects.equals(committedKey,other.committedKey)
                &&java.util.Objects.equals(pendingKey,other.pendingKey)
                &&recordBytes==other.recordBytes&&recordModified.equals(other.recordModified);
        }
    }
    static final class Existing implements AutoCloseable {
        private byte[] encoded;private final String digest,body,phase;private final ObservedIdentity observed;
        private Existing(byte[] encoded,String body,String phase)throws VaultFailure {
            this(encoded,body,phase,null);
        }
        private Existing(byte[] encoded,String body,String phase,ObservedIdentity observed)throws VaultFailure {
            this.encoded=encoded.clone();this.body=body;this.phase=phase;this.observed=observed;digest=NativeRetainedAttempt.hash(this.encoded);
        }
        private void requireOpen()throws VaultFailure {if(encoded==null||!digest.equals(NativeRetainedAttempt.hash(encoded)))throw invalid();}
        private boolean sameBytesAndBody(Existing other)throws VaultFailure {requireOpen();if(other==null)return false;other.requireOpen();return Arrays.equals(encoded,other.encoded)&&body.equals(other.body);}
        boolean sameOriginal(Existing other)throws VaultFailure {return sameBytesAndBody(other)&&phase.equals(other.phase);}
        boolean sameObservedOriginal(Existing other)throws VaultFailure {
            return sameOriginal(other)&&observed!=null&&observed.same(other.observed);
        }
        JSONObject metadata()throws VaultFailure {requireOpen();try{return new JSONObject(body).put("journal_record_sha256",digest).put("journal_record_bytes",encoded.length)
            .put("journal_phase",phase).put("protected_storage_domain",DIRECTORY).put("key_family",NativeProtectedNamespaceObservation.SHARED_KEY)
            .put("local_operation_committed_observed",phase.equals("COMMITTED"));}catch(Exception e){throw invalid();}}
        @Override public void close(){if(encoded!=null)Arrays.fill(encoded,(byte)0);encoded=null;}
    }
    /** Opaque, UNQUALIFIED identity hint from one already committed encrypted
     * record. It selects the original generation only inside the owning Engine.
     * It is not an authenticated provider admission, frame, query, inventory,
     * resend or retirement capability. Full original frame comparison MUST
     * follow before any recovered observation is returned. */
    static final class SavedIdentityHint implements AutoCloseable {
        private final NativePrivateCustodyOperationStore owner;private final Existing original;
        private boolean closed;
        private SavedIdentityHint(NativePrivateCustodyOperationStore owner,Existing original){this.owner=owner;this.original=original;}
        String generationForOwningEngine()throws VaultFailure {
            requireOpen();try{return new JSONObject(original.body).getString("original_generation_id");}catch(Exception e){throw invalid();}
        }
        String phaseForOwningEngine()throws VaultFailure {requireOpen();return original.phase;}
        boolean matchesFullyVerifiedOperation(Existing actual)throws VaultFailure {requireOpen();return original.sameObservedOriginal(actual);}
        private void requireOpen()throws VaultFailure {if(closed)throw invalid();original.requireOpen();}
        @Override public void close(){closed=true;original.close();}
    }
    /** Read only. No absent/pending promotion, new UUID, encryption, key init,
     * replacement timestamp, frame selection or arbitrary JSON input. Normal
     * frame-bound inspectOriginal/prepareOriginal/resume remain unchanged. */
    SavedIdentityHint inspectSavedIdentityHint()throws VaultFailure {
        enter();
        Existing original=null;
        try{requireDirectory(root);requireStoreDirectory();requireLockFile();
            try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                if(held==null||!exists(committed)||exists(pending))throw invalid();
                original=readSavedIdentityFile();requirePreparedIdentity(original);var result=new SavedIdentityHint(this,original);original=null;return result;
            }
        }catch(Exception e){throw invalid();}finally{if(original!=null)original.close();leave();}
    }
    void requireSavedIdentityHintCurrent(SavedIdentityHint hint)throws VaultFailure {
        if(hint==null||hint.owner!=this)throw invalid();hint.requireOpen();
        try(var current=inspectSavedIdentityHint()){if(!hint.original.sameObservedOriginal(current.original))throw invalid();}
    }
    /** Separate pending/alias hint only; STRICT committed hint behavior above
     * is unchanged. Both fixed names must be the same inode and exact bytes
     * for an alias. Nothing is promoted, rewritten, cleared or allocated. */
    SavedIdentityHint inspectPendingIdentityHint()throws VaultFailure {
        enter();
        Existing original=null;
        try{requireDirectory(root);requireStoreDirectory();requireLockFile();
            try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                if(held==null||!exists(pending))throw invalid();boolean alias=exists(committed);
                if(alias&&!Files.isSameFile(committed,pending))throw invalid();
                String phase=alias?"COMMITTED_PENDING_ALIAS":"PENDING";
                // Same canonical selected name as readCurrent; the pending alias
                // remains independently inspected and part of both identities.
                original=readSavedIdentityAt(alias?committed:pending,phase);
                if(alias)try(var current=readSavedIdentityAt(pending,phase)){if(!original.sameOriginal(current))throw invalid();}
                requirePreparedIdentity(original);
                var result=new SavedIdentityHint(this,original);original=null;return result;
            }
        }catch(Exception e){throw invalid();}finally{if(original!=null)original.close();leave();}
    }
    void requirePendingIdentityHintCurrent(SavedIdentityHint hint)throws VaultFailure {
        if(hint==null||hint.owner!=this)throw invalid();hint.requireOpen();
        try(var current=inspectPendingIdentityHint()){if(!hint.original.sameObservedOriginal(current.original))throw invalid();}
    }
    private Existing readSavedIdentityFile()throws Exception {
        return readSavedIdentityAt(committed,"COMMITTED");
    }
    private Existing readSavedIdentityAt(Path path,String phase)throws Exception {
        ObservedIdentity identity=new ObservedIdentity(this,path,phase);
        BasicFileAttributes before=requirePrivateFile(path);long size=before.size();if(size<64||size>MAX_RECORD)throw invalid();byte[] bytes=new byte[(int)size];
        try(FileChannel input=FileChannel.open(path,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            if(input.size()!=size)throw invalid();ByteBuffer buffer=ByteBuffer.wrap(bytes);long start=System.nanoTime();
            while(buffer.hasRemaining()){if(System.nanoTime()-start>30_000_000_000L||input.read(buffer)<=0)throw invalid();}
            if(input.read(ByteBuffer.allocate(1))!=-1)throw invalid();BasicFileAttributes after=requirePrivateFile(path);
            if(!java.util.Objects.equals(before.fileKey(),after.fileKey())||before.size()!=after.size()||!before.lastModifiedTime().equals(after.lastModifiedTime()))throw invalid();
            char[] clear=cipher.decrypt(decode(bytes));
            try{String text=new String(clear);originalBody(text);
                if(!identity.same(new ObservedIdentity(this,path,phase)))throw invalid();
                return new Existing(bytes,text,phase,identity);
            }finally{VaultValidation.wipe(clear);}
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    /** Inspect creates nothing and does not promote a pending original. A
     * missing operation cannot be recovered by minting a replacement ID. */
    Existing inspectOriginal(VaultEngine.NativePrivateCustodyTransportFrame frame)throws VaultFailure {
        enter();
        try {JSONObject binding=binding(frame);requireDirectory(root);if(!exists(directory))throw invalid();requireStoreDirectory();requireLockFile();
            try(FileChannel channel=openLock();FileLock held=channel.tryLock()){if(held==null)throw invalid();return currentFrameResult(frame,readCurrent(binding));}
        }catch(VaultFailure failure){
            if(FAILURE.equals(failure.code)&&failure.httpStatus==0&&"".equals(failure.remoteReason))throw failure;
            throw invalid();
        }catch(Exception e){throw invalid();}finally{leave();}
    }
    /** Allocate ONLY under the fixed lock when neither original file exists.
     * Existing pending/committed records are decrypted/bound, never re-encrypted.
     * Crash in the partial-write window is UNKNOWN, preserved, not auto-repaired. */
    Existing prepareOriginal(VaultEngine.NativePrivateCustodyTransportFrame frame)throws VaultFailure {
        enter();
        try{return prepareOriginalUnderReservation(frame);}finally{leave();}
    }
    /** SAME original preparation body; only its active reservation owner may
     * call it. Public preparation enters/leaves; first retention transfers its
     * already-active lease and settles that lease after the entire body. */
    private Existing prepareOriginalUnderReservation(VaultEngine.NativePrivateCustodyTransportFrame frame)throws VaultFailure {
        return prepareOriginalUnderReservation(frame,null);
    }
    private static void checkInvocation(NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        if(control!=null)control.check(); // null is used only by unchanged legacy internal entry points
    }
    private Existing prepareOriginalUnderReservation(VaultEngine.NativePrivateCustodyTransportFrame frame,
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        try {checkInvocation(control);if(frame==null)throw invalid();frame.requireOrdinaryOperationWriter();
            JSONObject binding=binding(frame);checkInvocation(control);frame.requireOrdinaryOperationWriter();
            if(preparation.original==null)ensureStoreDirectory(control);else preparation.original.requireContext(this,binding);
            checkInvocation(control);
            try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                checkInvocation(control);if(held==null)throw invalid();requireStoreDirectory();
                if(exists(committed)||exists(pending)) {
                    // Merely readable is not a successful original force. A
                    // known process candidate must authenticate EXACTLY before
                    // force-only recovery; pending/alias promotion stays explicit.
                    if(preparation.original!=null) {
                        checkInvocation(control);try(var saved=readCurrent(binding)){checkInvocation(control);requirePreparedIdentity(saved);}
                        frame.metadata();frame.requireOrdinaryOperationWriter();checkInvocation(control);
                        forceKnownOriginal(exists(committed)?committed:pending,control);
                        frame.requireOrdinaryOperationWriter();forceDirectory(control);
                    }
                    checkInvocation(control);Existing result=currentFrameResult(frame,readCurrent(binding),control);
                    forgetPrepared();return result;
                }
                if(preparation.original==null) {
                    checkInvocation(control);frame.requireOrdinaryOperationWriter();
                    String body=new JSONObject(binding.toString()).put("schema",SCHEMA).put("operation_id",UUID.randomUUID().toString()).toString();
                    preparation.original=new PreparedOriginal(this,binding,body);
                    char[] clear=body.toCharArray();
                    try {frame.metadata();frame.requireOrdinaryOperationWriter();checkInvocation(control);EncryptedSecret secret=cipher.encryptWithExistingKey(clear);byte[] bytes=encode(secret);
                        try{preparation.original.record=new Existing(bytes,body,"COMMITTED");}finally{Arrays.fill(bytes,(byte)0);}
                    }finally{VaultValidation.wipe(clear);}
                    // A failed post-encryption currentness check keeps the first
                    // candidate, never a replacement UUID/IV on the next call.
                    frame.metadata();checkInvocation(control);
                }
                PreparedOriginal original=preparation.original;original.requireContext(this,binding);
                Existing candidate=original.record;if(candidate==null)throw invalid();
                checkInvocation(control);requirePreparedCrypto(original);frame.metadata();frame.requireOrdinaryOperationWriter();checkInvocation(control);
                if(control!=null&&pendingWriter==normalPendingWriter) {
                    // Normal FIRST native publication allocates the immutable
                    // fixed file absent-only. Android app_data_file policy can
                    // forbid hard links; never retry that denial or use a
                    // replacement rename. A partial/uncertain original stays
                    // retained and cannot be a readable committed observation.
                    writeCommittedOriginal(candidate,control);
                    frame.requireOrdinaryOperationWriter();forceDirectory(control);
                    requireExact(committed,candidate,binding,control);frame.metadata();
                    frame.requireOrdinaryOperationWriter();checkInvocation(control);
                    Existing result=currentFrameResult(frame,readCurrent(binding),control);
                    forgetPrepared();return result;
                }
                try{
                    checkInvocation(control);
                    if(control!=null&&pendingWriter==normalPendingWriter)writePendingOriginal(candidate,control);
                    else pendingWriter.write(candidate);
                    checkInvocation(control);
                }finally{rememberPendingIdentity(original);}
                frame.requireOrdinaryOperationWriter();forceDirectory(control);requireExact(pending,candidate,binding,control);frame.metadata();checkInvocation(control);
                if(exists(committed))throw invalid();checkInvocation(control);frame.requireOrdinaryOperationWriter();
                if(control==null)Files.createLink(committed,pending);else resumeIo.linkPending();
                checkInvocation(control);frame.requireOrdinaryOperationWriter();forceDirectory(control);requireExact(committed,candidate,binding,control);
                frame.metadata();frame.requireOrdinaryOperationWriter();checkInvocation(control);removePendingAlias(candidate,binding,control);
                checkInvocation(control);Existing result=currentFrameResult(frame,readCurrent(binding),control);forgetPrepared();return result;
            }
        }catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }
    /** Explicit SAME saved ciphertext pending promotion. No encryption, new
     * operation, new generation or new original WORK signature is used. */
    Existing resumeOriginal(VaultEngine.NativePrivateCustodyTransportFrame frame,Existing expected)throws VaultFailure {
        // Fixed normal protocol chosen before any I/O, never a failure fallback.
        final boolean normalPendingPublication=resumeIo==normalResumeIo;
        enter();
        try {if(frame==null)throw invalid();frame.requireOrdinaryOperationWriter();
            JSONObject binding=binding(frame);expected.requireOpen();requireDirectory(root);requireStoreDirectory();requireLockFile();
            try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                if(held==null)throw invalid();try(var current=readCurrent(binding)){if(!expected.sameObservedOriginal(current))throw invalid();}
                // Restart loses process ownership, not the requirement to force
                // this exact original before publication or deleting its alias.
                frame.metadata();frame.requireOrdinaryOperationWriter();resumeIo.forceOriginal();
                frame.requireOrdinaryOperationWriter();forceDirectory();
                try(var current=readCurrent(binding)){if(!expected.sameObservedOriginal(current))throw invalid();}frame.metadata();
                if(!exists(committed)){if(!exists(pending))throw invalid();requireExact(pending,expected,binding);
                    if(normalPendingPublication){
                        try(var publication=new PendingResumePublication(frame,expected,binding,channel,held)){
                            FileChannel reserved=publication.reserveDestination();
                            publication.requireReservedDestination(reserved);
                            Files.move(pending,committed,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
                            publication.requirePublishedOriginal(reserved);
                        }
                        frame.requireOrdinaryOperationWriter();forceDirectory();
                        if(exists(pending))throw invalid();requireExact(committed,expected,binding);
                        frame.metadata();frame.requireOrdinaryOperationWriter();
                        Existing result=currentFrameResult(frame,readCurrent(binding));forgetPrepared();return result;
                    }
                    frame.requireOrdinaryOperationWriter();resumeIo.linkPending();frame.requireOrdinaryOperationWriter();forceDirectory();}
                requireExact(committed,expected,binding);frame.requireOrdinaryOperationWriter();if(exists(pending))removePendingAlias(expected,binding);
                Existing result=currentFrameResult(frame,readCurrent(binding));forgetPrepared();return result;
            }
        }catch(Exception e){throw resumeFailure(e);}finally{leave();}
    }
    /** Private SAME entered resume only. An observed original is DATA; this
     * object also needs the actual frame, active owner/thread and held lock.
     * It never exposes a path, publication permission, or recovery selector. */
    private final class PendingResumePublication implements AutoCloseable {
        private final VaultEngine.NativePrivateCustodyTransportFrame frame;
        private final Existing expected;
        private final JSONObject originalBinding;
        private final String bindingText;
        private final PreparedOriginal processOriginal;
        private final ObservedIdentity observed;
        private final FileChannel channel;
        private final FileLock held;
        private final Thread thread=Thread.currentThread();
        private final PosixFileAttributes rootAttributes,directoryAttributes,lockAttributes,sourceAttributes;
        private FileChannel reservation;
        private PosixFileAttributes reservedAttributes;
        private boolean attempted,published,closed;
        private PendingResumePublication(VaultEngine.NativePrivateCustodyTransportFrame frame,Existing expected,
            JSONObject originalBinding,FileChannel channel,FileLock held)throws Exception {
            this.frame=frame;this.expected=expected;this.originalBinding=originalBinding;bindingText=originalBinding.toString();
            this.channel=channel;this.held=held;processOriginal=preparation.original;observed=expected.observed;
            requireScope();
            if(!"PENDING".equals(expected.phase)||!observed.record.equals(pending)||observed.committedKey!=null
                ||!observed.recordKey.equals(observed.pendingKey)||exists(committed))throw invalid();
            rootAttributes=posix(root);directoryAttributes=posix(directory);lockAttributes=posix(lock);sourceAttributes=posix(pending);
            requireScope();requirePendingOriginal();
        }
        private void requireScope()throws Exception {
            if(closed||Thread.currentThread()!=thread||!preparation.active.get()||preparation.original!=processOriginal
                ||resumeIo!=normalResumeIo||observed==null||channel==null||!channel.isOpen()
                ||held==null||!held.isValid()||held.channel()!=channel)throw invalid();
            frame.requireOrdinaryOperationWriter();expected.requireOpen();
            if(!bindingText.equals(binding(frame).toString())||!root.equals(observed.root)||!directory.equals(observed.directory)
                ||!lock.equals(observed.lock))throw invalid();
            requireDirectory(root);requireStoreDirectory();requireLockFile();
            if(!observed.rootKey.equals(directoryKey(root))||!observed.directoryKey.equals(directoryKey(directory))
                ||!observed.lockKey.equals(fileKey(requirePrivateFile(lock))))throw invalid();
            if(processOriginal!=null){processOriginal.requireContext(NativePrivateCustodyOperationStore.this,originalBinding);
                if(processOriginal.record==null||!processOriginal.record.sameBytesAndBody(expected))throw invalid();}
            frame.requireOrdinaryOperationWriter();
        }
        private PosixFileAttributes posix(Path path)throws Exception {
            requireScope();var result=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            fileKey(result);requireScope();return result;
        }
        private void requireOwnership(Path path,PosixFileAttributes original)throws Exception {
            var actual=posix(path);
            if(!original.fileKey().equals(actual.fileKey())||!original.owner().equals(actual.owner())
                ||!original.group().equals(actual.group())||!original.permissions().equals(actual.permissions()))throw invalid();
        }
        private void requireLineage()throws Exception {
            requireScope();requireOwnership(root,rootAttributes);requireOwnership(directory,directoryAttributes);
            requireOwnership(lock,lockAttributes);requireLockFile();requireScope();
        }
        private void requireSourceAt(Path path)throws Exception {
            requireLineage();var actual=requirePrivateFile(path);
            if(!observed.recordKey.equals(fileKey(actual))||observed.recordBytes!=actual.size()
                ||!observed.recordModified.equals(actual.lastModifiedTime()))throw invalid();
            requireOwnership(path,sourceAttributes);requireExact(path,expected,originalBinding);requireScope();
            actual=requirePrivateFile(path);
            if(!observed.recordKey.equals(fileKey(actual))||observed.recordBytes!=actual.size()
                ||!observed.recordModified.equals(actual.lastModifiedTime()))throw invalid();
        }
        private void requirePendingOriginal()throws Exception {
            requireSourceAt(pending);
            if(observed.recordKey.equals(observed.lockKey))throw invalid();
        }
        private FileChannel reserveDestination()throws Exception {
            requirePendingOriginal();if(attempted||published||exists(committed))throw invalid();attempted=true;
            requireScope();
            reservation=FileChannel.open(committed,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
                PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
            reservedAttributes=posix(committed);requireReservedDestination(reservation);return reservation;
        }
        private void requireEmptyReservation(FileChannel actual)throws Exception {
            if(!attempted||published||actual==null||actual!=reservation||!actual.isOpen()||reservedAttributes==null
                ||actual.size()!=0||actual.position()!=0||reservedAttributes.size()!=0)throw invalid();
            var attributes=requirePrivateFile(committed);requireOwnership(committed,reservedAttributes);
            if(!reservedAttributes.fileKey().equals(fileKey(attributes))||attributes.size()!=0
                ||!reservedAttributes.lastModifiedTime().equals(attributes.lastModifiedTime()))throw invalid();
            Object key=reservedAttributes.fileKey();
            if(key.equals(observed.recordKey)||key.equals(observed.lockKey)||key.equals(observed.rootKey)||key.equals(observed.directoryKey))throw invalid();
            if(Files.isSameFile(committed,pending)||Files.isSameFile(committed,lock))throw invalid();requireScope();
        }
        private void requireReservedDestination(FileChannel actual)throws Exception {
            requirePendingOriginal();requireEmptyReservation(actual);
            requirePendingOriginal();requireEmptyReservation(actual);
            requireSourceAt(pending);
            var terminal=Files.readAttributes(committed,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            if(!terminal.isRegularFile()||terminal.isSymbolicLink()||terminal.size()!=0
                ||!reservedAttributes.fileKey().equals(terminal.fileKey())
                ||!reservedAttributes.lastModifiedTime().equals(terminal.lastModifiedTime())
                ||!reservedAttributes.owner().equals(terminal.owner())||!reservedAttributes.group().equals(terminal.group())
                ||!reservedAttributes.permissions().equals(terminal.permissions())||actual.size()!=0)throw invalid();
            frame.requireOrdinaryOperationWriter();expected.requireOpen();
            if(!held.isValid()||held.channel()!=channel||Thread.currentThread()!=thread)throw invalid();
            // No source/destination getter or other effect before the ONE move.
        }
        private void requirePublishedOriginal(FileChannel actual)throws Exception {
            requireScope();
            if(!attempted||published||actual!=reservation||!actual.isOpen()||actual.size()!=0||reservedAttributes==null||exists(pending))throw invalid();
            requireSourceAt(committed);requireLineage();
            if(exists(pending))throw invalid();frame.metadata();frame.requireOrdinaryOperationWriter();published=true;
        }
        @Override public void close()throws Exception {
            closed=true;if(reservation!=null)reservation.close();
            // Leave every original/empty/partial file; close no caller lock.
        }
    }
    private static VaultFailure resumeFailure(Exception cause){
        if(cause instanceof VaultFailure){VaultFailure original=(VaultFailure)cause;
            if(FAILURE.equals(original.code)&&original.httpStatus==0&&"".equals(original.remoteReason))return original;}
        return new VaultFailure(FAILURE,cause);
    }
    private static JSONObject binding(VaultEngine.NativePrivateCustodyTransportFrame frame)throws VaultFailure {
        if(frame==null)throw invalid();JSONObject binding=frame.operationBindingForFixedJournal();
        try{requireMutationStamp(binding.get("original_native_mutation_stamp"));return binding;}
        catch(Exception failure){throw invalid();}
    }
    private Existing currentFrameResult(VaultEngine.NativePrivateCustodyTransportFrame frame,Existing result)throws VaultFailure {
        return currentFrameResult(frame,result,null);
    }
    private Existing currentFrameResult(VaultEngine.NativePrivateCustodyTransportFrame frame,Existing result,
        NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        byte[] actual=null;Throwable primary=null;boolean transferred=false;
        try {
            checkInvocation(control);frame.metadata();checkInvocation(control);
            if(result==null||result.observed==null||!preparation.active.get())throw invalid();
            result.requireOpen();var original=result.observed;var encoded=result.encoded;
            if(!root.equals(original.root)||!directory.equals(original.directory)||!lock.equals(original.lock)
                ||encoded.length<64||encoded.length>MAX_RECORD||original.recordBytes!=encoded.length
                ||!original.same(new ObservedIdentity(this,original.record,result.phase)))throw invalid();
            // LAST full frame/Source/key callback above. Re-read the actual
            // original ciphertext AFTER it, under this caller's existing file
            // lock. An unchanged inode/mtime alone cannot close this read.
            actual=new byte[encoded.length];
            try(var input=FileChannel.open(original.record,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
                if(input.size()!=actual.length)throw invalid();var buffer=ByteBuffer.wrap(actual);long started=System.nanoTime();
                while(buffer.hasRemaining()){
                    checkInvocation(control);
                    if(System.nanoTime()-started>30_000_000_000L||input.read(buffer)<=0)throw invalid();
                }
                if(input.read(ByteBuffer.allocate(1))!=-1||!Arrays.equals(encoded,actual))throw invalid();
            }
            if(result.encoded!=encoded||!preparation.active.get()
                ||!original.same(new ObservedIdentity(this,original.record,result.phase)))throw invalid();
            result.requireOpen();checkInvocation(control);transferred=true;return result;
        }catch(Exception error){var failure=invalid();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(actual!=null)Arrays.fill(actual,(byte)0);
            if(!transferred&&result!=null)try{result.close();}catch(RuntimeException|Error cleanup){
                if(primary==null)throw cleanup;else primary.addSuppressed(cleanup);
            }
        }
    }
    private Existing readCurrent(JSONObject binding)throws Exception {
        if(preparation.original!=null)preparation.original.requireContext(this,binding);
        requireStoreDirectory();boolean c=exists(committed),p=exists(pending);
        if(c&&p){if(!Files.isSameFile(committed,pending))throw invalid();try(var a=readRecord(committed,binding,"COMMITTED_PENDING_ALIAS");var b=readRecord(pending,binding,"COMMITTED_PENDING_ALIAS")){if(!a.sameOriginal(b))throw invalid();}}
        Existing result=c?readRecord(committed,binding,p?"COMMITTED_PENDING_ALIAS":"COMMITTED"):p?readRecord(pending,binding,"PENDING"):null;
        if(result==null)throw invalid();try{requirePreparedIdentity(result);return result;}catch(Exception e){result.close();throw e;}
    }
    private void enter()throws VaultFailure {if(!preparation.active.compareAndSet(false,true))throw invalid();}
    private void leave(){preparation.active.set(false);}
    private void requirePreparedIdentity(Existing actual)throws Exception {
        PreparedOriginal original=preparation.original;if(original==null)return;original.requireIdentities(this);
        if(original.record==null||!original.record.sameBytesAndBody(actual))throw invalid();
    }
    private void requirePreparedCrypto(PreparedOriginal original)throws Exception {
        original.record.requireOpen();char[] clear=cipher.decrypt(decode(original.record.encoded));
        try{if(!original.body.equals(new String(clear)))throw invalid();}finally{VaultValidation.wipe(clear);}
    }
    private void forgetPrepared(){PreparedOriginal original=preparation.original;if(original!=null&&original.record!=null)original.record.close();preparation.original=null;}
    private void writePendingOriginal(Existing candidate)throws Exception {
        writePendingOriginal(candidate,null);
    }
    private void writePendingOriginal(Existing candidate,NativePrivateCustodyFrameReadControl control)throws Exception {
        checkInvocation(control);
        if(preparation.original==null||preparation.original.record!=candidate)throw invalid();preparation.original.requireIdentities(this);
        checkInvocation(control);
        try(FileChannel output=FileChannel.open(pending,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
            checkInvocation(control);rememberPendingIdentity(preparation.original);writeExact(output,candidate,control);}
    }
    /** One fixed absent-only native target; no path/ciphertext callback or
     * new operation/IV. CREATE_NEW refuses an existing/raced original rather
     * than replacing it. Complete write/force/readback is checked by its
     * owning caller before returning; path existence itself is never custody,
     * successful force, ACK, or Android power-loss proof. */
    private void writeCommittedOriginal(Existing candidate,NativePrivateCustodyFrameReadControl control)throws Exception {
        if(control==null)throw invalid();checkInvocation(control);
        if(preparation.original==null||preparation.original.record!=candidate)throw invalid();
        preparation.original.requireIdentities(this);checkInvocation(control);
        // Failed CREATE_NEW (including a raced foreign file) cannot be adopted
        // later merely because bytes match. Only successful creation followed
        // by its first exact identity observation clears this sticky refusal.
        preparation.original.directCreationUnobserved=true;
        try(FileChannel output=FileChannel.open(committed,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
            rememberCommittedIdentity(preparation.original);checkInvocation(control);writeExact(output,candidate,control);}
    }
    private void rememberCommittedIdentity(PreparedOriginal original)throws Exception {
        if(!exists(committed)||exists(pending))throw invalid();
        Object key=fileKey(requirePrivateFile(committed));
        if(original.pendingKey!=null&&!original.pendingKey.equals(key))throw invalid();
        original.pendingKey=key;original.directCreationUnobserved=false;
    }
    private void rememberPendingIdentity(PreparedOriginal original)throws Exception {
        if(!exists(pending))return;Object key=fileKey(requirePrivateFile(pending));
        if(original.pendingKey!=null&&!original.pendingKey.equals(key))throw invalid();original.pendingKey=key;
    }
    private static Object fileKey(BasicFileAttributes attributes)throws VaultFailure {Object key=attributes.fileKey();if(key==null)throw invalid();return key;}
    private static Object directoryKey(Path path)throws Exception {requireDirectory(path);return fileKey(Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS));}
    private void forceKnownOriginal(Path path)throws Exception {
        forceKnownOriginal(path,null);
    }
    private void forceKnownOriginal(Path path,NativePrivateCustodyFrameReadControl control)throws Exception {
        checkInvocation(control);
        BasicFileAttributes before=requirePrivateFile(path);
        checkInvocation(control);
        try(FileChannel output=FileChannel.open(path,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
            checkInvocation(control);output.force(true);checkInvocation(control);}
        BasicFileAttributes after=requirePrivateFile(path);
        if(!fileKey(before).equals(fileKey(after))||before.size()!=after.size()||!before.lastModifiedTime().equals(after.lastModifiedTime()))throw invalid();checkInvocation(control);
    }
    private Existing readRecord(Path path,JSONObject binding,String phase)throws Exception {
        return readRecord(path,binding,phase,true);
    }
    private Existing readRecord(Path path,JSONObject binding,String phase,boolean observe)throws Exception {
        ObservedIdentity identity=observe?new ObservedIdentity(this,path,phase):null;
        BasicFileAttributes before=requirePrivateFile(path);long size=before.size();if(size<64||size>MAX_RECORD)throw invalid();byte[] bytes=new byte[(int)size];
        try(FileChannel input=FileChannel.open(path,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            if(input.size()!=size)throw invalid();ByteBuffer buffer=ByteBuffer.wrap(bytes);long start=System.nanoTime();
            while(buffer.hasRemaining()){if(System.nanoTime()-start>30_000_000_000L||input.read(buffer)<=0)throw invalid();}
            if(input.read(ByteBuffer.allocate(1))!=-1)throw invalid();BasicFileAttributes after=requirePrivateFile(path);
            if(!java.util.Objects.equals(before.fileKey(),after.fileKey())||before.size()!=after.size()||!before.lastModifiedTime().equals(after.lastModifiedTime()))throw invalid();
            char[] clear=cipher.decrypt(decode(bytes));try {String text=new String(clear);originalBody(text,binding);
                if(identity!=null&&!identity.same(new ObservedIdentity(this,path,phase)))throw invalid();
                return new Existing(bytes,text,phase,identity);
            }finally{VaultValidation.wipe(clear);}
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    /** The SAME closed original validation is used by saved hints and fixed
     * frame reads. Parsing alone is never an owning frame or admission. */
    private static JSONObject originalBody(String text)throws Exception {
        if(text==null||text.length()>MAX_CLEAR)throw invalid();JSONObject value=new JSONObject(text);
        NativeRetainedAttempt.keys(value,"schema","operation_id","frame_sha256","frame_bytes","record_sha256","proof_wire_sha256","owner_binding_sha256",
            "principal_digest","original_generation_id","engine_revision","original_frozen_work_sha256","original_native_mutation_stamp");
        if(!value.toString().equals(text)||!SCHEMA.equals(value.get("schema")))throw invalid();
        for(var keys=value.keys();keys.hasNext();)if(!(value.get(keys.next()) instanceof String))throw invalid();
        String op=value.getString("operation_id");UUID id=UUID.fromString(op);if(!id.toString().equals(op)||id.version()!=4||id.variant()!=2)throw invalid();
        String generation=value.getString("original_generation_id");if(!UUID.fromString(generation).toString().equals(generation))throw invalid();
        for(String key:new String[]{"frame_sha256","record_sha256","proof_wire_sha256","owner_binding_sha256","principal_digest","original_frozen_work_sha256"})
            if(!value.getString(key).matches("[a-f0-9]{64}"))throw invalid();
        for(String key:new String[]{"frame_bytes","engine_revision"}){
            String encoded=value.getString(key);if(!encoded.matches("[1-9][0-9]{0,15}"))throw invalid();long count=Long.parseLong(encoded);
            if(count>9007199254740991L||!Long.toString(count).equals(encoded))throw invalid();
            if(key.equals("frame_bytes")&&(count<64||count>VaultEngine.NativePrivateCustodyTransportFrame.MAX_BYTES))throw invalid();
        }
        requireMutationStamp(value.get("original_native_mutation_stamp"));return value;
    }
    private static JSONObject originalBody(String text,JSONObject binding)throws Exception {
        JSONObject value=originalBody(text);requireMutationStamp(binding.get("original_native_mutation_stamp"));
        if(value.length()!=binding.length()+2)throw invalid();
        for(var keys=binding.keys();keys.hasNext();){String key=keys.next();
            if(!(value.get(key) instanceof String)||!binding.get(key).equals(value.get(key)))throw invalid();
        }return value;
    }
    private static void requireMutationStamp(Object original)throws VaultFailure {
        if(!(original instanceof String))throw invalid();String stamp=(String)original;
        if(stamp.equals("PROCESS_ONLY"))return; // explicitly NOT durable authority
        if(!stamp.startsWith("DURABLE_ATTEMPT:"))throw invalid();
        String counter=stamp.substring("DURABLE_ATTEMPT:".length());
        if(!counter.matches("0|[1-9][0-9]{0,18}"))throw invalid();
        try{if(!Long.toString(Long.parseLong(counter)).equals(counter))throw invalid();}
        catch(NumberFormatException overflow){throw invalid();}
    }
    private static byte[] encode(EncryptedSecret secret)throws Exception {
        byte[] iv=java.util.Base64.getDecoder().decode(secret.iv),ciphertext=java.util.Base64.getDecoder().decode(secret.ciphertext);
        try {if(iv.length!=12||ciphertext.length<17||ciphertext.length>MAX_CLEAR+16)throw invalid();byte[] result=new byte[4+4+12+4+ciphertext.length+32];
            ByteBuffer b=ByteBuffer.wrap(result);b.putInt(MAGIC).putInt(iv.length).put(iv).putInt(ciphertext.length).put(ciphertext);
            byte[] checksum=checksum(result,result.length-32);try{b.put(checksum);}finally{Arrays.fill(checksum,(byte)0);}return result;
        }finally{Arrays.fill(iv,(byte)0);Arrays.fill(ciphertext,(byte)0);}
    }
    private static EncryptedSecret decode(byte[] bytes)throws Exception {
        ByteBuffer b=ByteBuffer.wrap(bytes);if(b.getInt()!=MAGIC||b.getInt()!=12)throw invalid();byte[] iv=new byte[12];b.get(iv);int n=b.getInt();
        if(n<17||n>MAX_CLEAR+16||b.remaining()!=n+32)throw invalid();byte[] ciphertext=new byte[n],saved=new byte[32],expected=null;
        try {b.get(ciphertext).get(saved);expected=checksum(bytes,bytes.length-32);if(!java.security.MessageDigest.isEqual(saved,expected))throw invalid();
            return new EncryptedSecret(java.util.Base64.getEncoder().encodeToString(ciphertext),java.util.Base64.getEncoder().encodeToString(iv));
        }finally{Arrays.fill(iv,(byte)0);Arrays.fill(ciphertext,(byte)0);Arrays.fill(saved,(byte)0);if(expected!=null)Arrays.fill(expected,(byte)0);}
    }
    private static byte[] checksum(byte[] bytes,int length)throws Exception {var hash=java.security.MessageDigest.getInstance("SHA-256");hash.update(bytes,0,length);return hash.digest();}
    private static void writeExact(FileChannel output,Existing record)throws Exception {writeExact(output,record,null);}
    private static void writeExact(FileChannel output,Existing record,NativePrivateCustodyFrameReadControl control)throws Exception {
        checkInvocation(control);record.requireOpen();ByteBuffer bytes=ByteBuffer.wrap(record.encoded);long start=System.nanoTime();
        while(bytes.hasRemaining()){
            checkInvocation(control);if(System.nanoTime()-start>30_000_000_000L||output.write(bytes)<=0)throw invalid();checkInvocation(control);
        }
        checkInvocation(control);output.force(true);checkInvocation(control);
    }
    private void requireExact(Path path,Existing expected,JSONObject binding)throws Exception {requireExact(path,expected,binding,null);}
    private void requireExact(Path path,Existing expected,JSONObject binding,NativePrivateCustodyFrameReadControl control)throws Exception {
        checkInvocation(control);try(var actual=readRecord(path,binding,expected.phase,false)){
            checkInvocation(control);if(!expected.sameOriginal(actual))throw invalid();checkInvocation(control);}
    }
    private void removePendingAlias(Existing expected,JSONObject binding)throws Exception {removePendingAlias(expected,binding,null);}
    private void removePendingAlias(Existing expected,JSONObject binding,NativePrivateCustodyFrameReadControl control)throws Exception {
        checkInvocation(control);requireStoreDirectory();if(!exists(committed)||!exists(pending)||!Files.isSameFile(committed,pending))throw invalid();
        requireExact(committed,expected,binding,control);requireExact(pending,expected,binding,control);
        checkInvocation(control);Files.delete(pending);checkInvocation(control);forceDirectory(control);
    }
    private void ensureStoreDirectory()throws Exception {ensureStoreDirectory(null);}
    private void ensureStoreDirectory(NativePrivateCustodyFrameReadControl control)throws Exception {
        checkInvocation(control);requireDirectory(root);if(!exists(directory)){
            checkInvocation(control);Files.createDirectory(directory,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            checkInvocation(control);force(root,control);
        }
        requireStoreDirectory();checkInvocation(control);if(!exists(lock)){
            checkInvocation(control);try(FileChannel out=FileChannel.open(lock,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
                PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
                checkInvocation(control);out.force(true);checkInvocation(control);
            }forceDirectory(control);
        }requireLockFile();checkInvocation(control);
    }
    private void requireStoreDirectory()throws Exception {requireDirectory(directory);if(!Files.getPosixFilePermissions(directory,LinkOption.NOFOLLOW_LINKS).equals(PosixFilePermissions.fromString("rwx------")))throw invalid();
        try(var paths=Files.newDirectoryStream(directory)){for(Path p:paths)if(!ARTIFACTS.contains(p.getFileName().toString()))throw invalid();}
        for(Path p:new Path[]{committed,pending,lock})if(exists(p))requirePrivateFile(p);}
    private void requireLockFile()throws Exception {if(requirePrivateFile(lock).size()!=0)throw invalid();}
    private FileChannel openLock()throws Exception {requireLockFile();return FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);}
    private static BasicFileAttributes requirePrivateFile(Path p)throws Exception {var a=Files.readAttributes(p,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!a.isRegularFile()||a.isSymbolicLink()||!Files.getPosixFilePermissions(p,LinkOption.NOFOLLOW_LINKS).equals(PosixFilePermissions.fromString("rw-------")))throw invalid();return a;}
    private static void requireDirectory(Path p)throws Exception {var a=Files.readAttributes(p,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!a.isDirectory()||a.isSymbolicLink()||!p.toFile().getAbsoluteFile().equals(p.toFile().getCanonicalFile()))throw invalid();}
    private void forceDirectory()throws Exception {forceDirectory(null);}
    private void forceDirectory(NativePrivateCustodyFrameReadControl control)throws Exception {
        checkInvocation(control);requireDirectory(directory);if(preparation.original!=null)preparation.original.requireIdentities(this);force(directory,control);checkInvocation(control);
    }
    private static void force(Path p)throws Exception {force(p,null);}
    private static void force(Path p,NativePrivateCustodyFrameReadControl control)throws Exception {
        checkInvocation(control);try(FileChannel c=FileChannel.open(p,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            checkInvocation(control);c.force(true);checkInvocation(control);
        }
    }
    private static boolean exists(Path p)throws Exception {try{Files.readAttributes(p,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);return true;}
        catch(java.nio.file.NoSuchFileException absent){return false;}}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
