package org.memphiszoo.custodial.vault;

import android.content.Context;
import java.io.File;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.PosixFileAttributes;
import java.nio.file.attribute.PosixFilePermissions;
import java.nio.file.attribute.UserPrincipal;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Set;
import java.util.Map;
import java.util.HashMap;

/** Unmounted native attempted-write counter. Handles bind actual private file
 * observations; no JSON, caller counter, auth or release API.
 * A successful prepare forces the next record before a caller may begin its
 * owning write. Main must hold the native coordinator across that composition.
 * Host force/readback is not Android power-loss qualification. */
final class NativePrivateMutationEpochStore {
    static final String DIRECTORY="custodial-private-mutation-epoch-v1";
    static final String CURRENT="epoch.current",PENDING="epoch.pending",PREVIOUS="epoch.previous",LOCK="epoch.lock";
    static final String BASELINE="epoch.baseline",BOOTSTRAP="epoch.bootstrap.pending";
    static final String EXTERNAL_UNKNOWN="epoch.external-write.unknown";
    static final String FAILURE="custodial_native_mutation_epoch_unavailable";
    static final int MAGIC=0x4d5a4531,RECORD_BYTES=56;
    private static final int MAX_HELD_RECORD_BYTES=4096;
    private static final Set<String> ARTIFACTS=Set.of(CURRENT,PENDING,PREVIOUS,LOCK,BASELINE,BOOTSTRAP);
    private static final Object COORDINATOR=AndroidProtectedWorkPreferences.retainedCommitLock();
    private final Path root,directory,current,pending,previous,lock;
    private final Object rootKey,directoryKey,lockKey,baselineKey;
    private final byte[] baselineBytes;
    private final UserPrincipal owner;
    // Immutable owner identity, NOT attributes/currentness. Null keeps the
    // original principal comparison for unsupported or inaccessible provenance.
    private final Long ownerUid;
    private final ContextRoot contextRoot;

    // Fixed private fault seam, analogous to the existing original-operation
    // store. Neither native factory exposes a path callback or injected I/O.
    private interface Io {
        void forceFile(FileChannel channel)throws Exception;
        void forceDirectory(FileChannel channel)throws Exception;
        void linkPredecessor()throws Exception;
        void unlinkPredecessorCurrent()throws Exception;
        void linkCandidate()throws Exception;
        void unlinkPending()throws Exception;
        void unlinkPrevious()throws Exception;
    }
    private final Io normalIo=new Io(){
        public void forceFile(FileChannel channel)throws Exception{channel.force(true);}
        public void forceDirectory(FileChannel channel)throws Exception{channel.force(true);}
        public void linkPredecessor()throws Exception{Files.createLink(previous,current);}
        public void unlinkPredecessorCurrent()throws Exception{Files.delete(current);}
        public void linkCandidate()throws Exception{Files.createLink(current,pending);}
        public void unlinkPending()throws Exception{Files.delete(pending);}
        public void unlinkPrevious()throws Exception{Files.delete(previous);}
    };
    private Io io=normalIo;
    private interface PendingWriter {void write(byte[] bytes)throws Exception;}
    private PendingWriter pendingWriter=this::writePending;
    private OriginalHoldReadLoan originalHoldReadLoan;
    private OriginalEnrollmentCommit originalEnrollmentCommit;
    private OrdinaryExternalWrite ordinaryExternalWrite;

    private NativePrivateMutationEpochStore(File nativeRoot)throws VaultFailure {this(nativeRoot,null);}
    private NativePrivateMutationEpochStore(File nativeRoot,ContextRoot contextRoot)throws VaultFailure {
        this.contextRoot=contextRoot;
        try{
            if(nativeRoot==null||!nativeRoot.isAbsolute()||!nativeRoot.getAbsoluteFile().equals(nativeRoot.getCanonicalFile()))throw invalid();
            root=nativeRoot.toPath();requireRootDirectory(root,contextRoot);
            var rootAttributes=Files.readAttributes(root,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            rootKey=rootAttributes.fileKey();if(rootKey==null)throw invalid();owner=rootAttributes.owner();
            if(contextRoot==null)ownerUid=originalNativeUid(root,owner,rootKey);
            else{contextRoot.requireRoot(root);if(!contextRoot.key.equals(rootKey)||!contextRoot.owner.equals(owner))throw invalid();ownerUid=contextRoot.uid;}
            directory=root.resolve(DIRECTORY);current=directory.resolve(CURRENT);pending=directory.resolve(PENDING);
            previous=directory.resolve(PREVIOUS);lock=directory.resolve(LOCK);
            requireDirectory(directory);directoryKey=key(directory);lockKey=key(lock);baselineKey=key(directory.resolve(BASELINE));
            baselineBytes=validatedBaseline(root,directory,owner);requireBase();
        }catch(Exception error){throw invalid();}
    }
    /** Read-only observation of the ORIGINAL application root, not a caller
     * File canonicalizer or journal/bootstrap admission. Android may expose a
     * parent alias (for example /data/user/0 versus /data/data). Only that
     * Context-derived path may resolve here; its final component must itself
     * be a directory, with the same native inode and application owner on
     * both sides of resolution. No legacy-root permission profile is added. */
    static File originalContextNoBackupRoot(Context context)throws VaultFailure {
        try{
            if(context==null)throw invalid();
            Context application=context.getApplicationContext();
            if(application==null||application.getApplicationContext()!=application)throw invalid();
            int applicationUid=android.os.Process.myUid();
            if(applicationUid<0||application.getApplicationInfo()==null
                ||application.getApplicationInfo().uid!=applicationUid)throw invalid();
            File original=application.getNoBackupFilesDir();
            if(original==null||!original.isAbsolute())throw invalid();
            Path originalPath=original.toPath();
            var before=Files.readAttributes(originalPath,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            if(!before.isDirectory()||before.isSymbolicLink()||before.fileKey()==null
                ||!coreNativeOwner(originalPath,before.owner())||uid(originalPath)!=applicationUid)throw invalid();
            File canonical=original.getCanonicalFile();
            var observed=new ExistingRoot(canonical);
            if(!before.fileKey().equals(observed.key)||!before.owner().equals(observed.owner)
                ||observed.uid!=applicationUid)throw invalid();

            // Re-read the SAME original Context and both actual filesystem
            // names. Equal path strings alone cannot establish root identity.
            if(context.getApplicationContext()!=application
                ||application.getApplicationContext()!=application
                ||application.getApplicationInfo()==null
                ||application.getApplicationInfo().uid!=applicationUid
                ||android.os.Process.myUid()!=applicationUid)throw invalid();
            File current=application.getNoBackupFilesDir();
            if(current==null||!original.equals(current)
                ||!canonical.equals(current.getCanonicalFile()))throw invalid();
            observed.require(canonical);
            var after=Files.readAttributes(originalPath,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            if(!after.isDirectory()||after.isSymbolicLink()||!before.fileKey().equals(after.fileKey())
                ||!before.owner().equals(after.owner())||uid(originalPath)!=applicationUid
                ||!canonical.equals(original.getCanonicalFile()))throw invalid();
            observed.require(canonical);return canonical;
        }catch(Exception failure){throw invalid();}
    }
    /** Read-only ORIGINAL Android Context provenance, not a baseline, epoch,
     * selected permission policy or effect capability. The OS-managed parent
     * can be 0771; its journal child remains exactly 0700. File-only factories
     * cannot obtain this exception or choose a mode/root on a caller's behalf. */
    static final class ContextRoot {
        private final Context application;
        private final Path path;
        private final Object key;
        private final UserPrincipal owner;
        private final long uid,gid;
        private final int mode;
        private volatile boolean refused;
        private ContextRoot(Context context)throws VaultFailure {
            try{
                if(context==null)throw invalid();application=context.getApplicationContext();
                if(application==null||application.getApplicationContext()!=application)throw invalid();
                path=originalContextNoBackupRoot(context).toPath();
                var values=readOriginal(true);Object principal=values.get("owner");
                if(!(principal instanceof UserPrincipal)||!coreNativeOwner(path,(UserPrincipal)principal)
                    ||values.get("fileKey")==null||!(values.get("mode") instanceof Integer))throw invalid();
                key=values.get("fileKey");owner=(UserPrincipal)principal;
                uid=uidValue(values.get("uid"));gid=uidValue(values.get("gid"));
                int nativeMode=(Integer)values.get("mode");mode=nativeMode&07777;
                if((nativeMode&0170000)!=0040000||(mode!=0700&&mode!=0771)
                    ||uid!=android.os.Process.myUid()||gid!=uid
                    ||application.getApplicationInfo()==null||application.getApplicationInfo().uid!=uid)throw invalid();
                requireCurrent();
            }catch(Exception failure){throw invalid();}
        }
        private Map<String,Object> readOriginal(boolean originalOwner) throws Exception {
            if(application.getApplicationContext()!=application
                ||!path.equals(originalContextNoBackupRoot(application).toPath()))throw invalid();
            // Same fresh stat position. The constructor binds owner and UID in
            // one stat; later core reads compare that exact native identity
            // without repeating the platform's user-name translation.
            return Files.readAttributes(path,originalOwner
                ?"unix:uid,gid,mode,fileKey,owner":"unix:uid,gid,mode,fileKey",LinkOption.NOFOLLOW_LINKS);
        }
        void requireCurrent()throws VaultFailure {
            try{
                if(refused)throw invalid();boolean nativeOwner=coreNativeOwner(path,owner);
                var values=readOriginal(!nativeOwner);Object principal=values.get("owner");
                if(nativeOwner&&!coreNativeOwner(path,owner)
                    ||!nativeOwner&&(!(principal instanceof UserPrincipal)||!coreNativeOwner(path,(UserPrincipal)principal)
                        ||!owner.equals(principal)))throw invalid();
                if(!key.equals(values.get("fileKey"))
                    ||uidValue(values.get("uid"))!=uid||uidValue(values.get("gid"))!=gid
                    ||!(values.get("mode") instanceof Integer)
                    ||(((Integer)values.get("mode"))&0170000)!=0040000
                    ||(((Integer)values.get("mode"))&07777)!=mode
                    ||android.os.Process.myUid()!=uid||application.getApplicationInfo()==null
                    ||application.getApplicationInfo().uid!=uid
                    ||!path.equals(originalContextNoBackupRoot(application).toPath()))throw invalid();
            }catch(Exception failure){refused=true;throw invalid();}
            catch(Error failure){refused=true;throw failure;}
        }
        private void requireRoot(Path actual)throws VaultFailure {
            requireCurrent();if(actual==null||!path.equals(actual)){refused=true;throw invalid();}
        }
    }
    static ContextRoot observeOriginalContextRoot(Context context)throws VaultFailure {
        return new ContextRoot(context);
    }
    static NativePrivateMutationEpochStore fromContext(Context context)throws VaultFailure {
        try{
            var original=observeOriginalContextRoot(context);
            var store=new NativePrivateMutationEpochStore(original.path.toFile(),original);
            original.requireCurrent();store.requireSameNativeContext(context);return store;
        }
        catch(Exception error){throw invalid();}
    }
    static NativePrivateMutationEpochStore fromNativeNoBackupRoot(File root)throws VaultFailure {
        return new NativePrivateMutationEpochStore(root);
    }
    /** Native lifecycle attachment of an ALREADY established journal. A
     * missing fixed child is legacy process-only, never an initialized zero.
     * Corrupt/partial/foreign storage is not treated as missing. */
    static NativePrivateMutationEpochStore existingFromContextOrAbsent(Context context)throws VaultFailure {
        try{
            var original=observeOriginalContextRoot(context);File root=original.path.toFile();
            var store=existingFromOriginalRootOrAbsent(root,original,false);
            original.requireCurrent();
            if(store!=null)store.requireSameNativeContext(context);
            else if(exists(root.toPath().resolve(DIRECTORY)))throw invalid();
            return store;
        }catch(Exception failure){throw invalid();}
    }
    /** Checked read-only storage leaf. Absence is not a counter baseline and
     * does not impose a new permission profile on a legacy no-backup root. */
    static NativePrivateMutationEpochStore existingFromNativeNoBackupRootOrAbsent(File nativeRoot)throws VaultFailure {
        return existingFromOriginalRootOrAbsent(nativeRoot,null,false);
    }
    private static NativePrivateMutationEpochStore existingFromOriginalRootOrAbsent(File nativeRoot,
        ContextRoot contextRoot,boolean recover)throws VaultFailure {
        synchronized(COORDINATOR){try{
            if(contextRoot!=null)contextRoot.requireRoot(nativeRoot.toPath());
            if(nativeRoot==null||!nativeRoot.isAbsolute()
                ||!nativeRoot.getAbsoluteFile().equals(nativeRoot.getCanonicalFile()))throw invalid();
            Path root=nativeRoot.toPath();
            var before=existingRootAttributes(root);
            BasicFileAttributes child;
            try{child=Files.readAttributes(root.resolve(DIRECTORY),BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);}
            catch(java.nio.file.NoSuchFileException absent){
                requireExistingRoot(root,before.fileKey());
                if(exists(root.resolve(DIRECTORY)))throw invalid();
                requireExistingRoot(root,before.fileKey());if(contextRoot!=null)contextRoot.requireRoot(root);return null;
            }
            var existing=new NativePrivateMutationEpochStore(nativeRoot,contextRoot);
            if(!before.fileKey().equals(existing.rootKey)||!child.fileKey().equals(existing.directoryKey))throw invalid();
            try(var current=recover?existing.recoverCurrentMetadata():existing.readCurrent()){existing.requireCurrent(current);}
            requireExistingRoot(root,before.fileKey());existing.requireBase();
            if(contextRoot!=null)contextRoot.requireRoot(root);return existing;
        }catch(Exception failure){throw invalid();}}
    }
    /** Explicit native startup recovery of existing metadata only. No absent
     * directory, baseline or attempted counter is provisioned by this entry. */
    static NativePrivateMutationEpochStore recoverExistingFromContextOrAbsent(Context context)throws VaultFailure {
        try{
            var original=observeOriginalContextRoot(context);File root=original.path.toFile();
            var store=existingFromOriginalRootOrAbsent(root,original,true);
            original.requireCurrent();
            if(store!=null)store.requireSameNativeContext(context);
            else if(exists(root.toPath().resolve(DIRECTORY)))throw invalid();
            return store;
        }catch(Exception failure){throw invalid();}
    }
    static NativePrivateMutationEpochStore recoverExistingFromNativeNoBackupRootOrAbsent(File nativeRoot)throws VaultFailure {
        return existingFromOriginalRootOrAbsent(nativeRoot,null,true);
    }
    private static BasicFileAttributes existingRootAttributes(Path root)throws Exception {
        var attributes=Files.readAttributes(root,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!attributes.isDirectory()||attributes.isSymbolicLink()||attributes.fileKey()==null
            ||!root.toFile().getAbsoluteFile().equals(root.toFile().getCanonicalFile()))throw invalid();
        return attributes;
    }
    private static void requireExistingRoot(Path root,Object originalKey)throws Exception {
        if(!originalKey.equals(existingRootAttributes(root).fileKey()))throw invalid();
    }
    /** Private registry retry binding, including the absent-journal case. It
     * cannot be minted from a counter or used to provision any artifact. */
    static final class ExistingRoot {
        private final Path path;private final Object key;private final UserPrincipal owner;private final long uid;
        private final Long originalOwnerUid;
        private ExistingRoot(File root)throws Exception {
            if(root==null||!root.isAbsolute()||!root.getAbsoluteFile().equals(root.getCanonicalFile()))throw invalid();
            path=root.toPath();key=existingRootAttributes(path).fileKey();
            var originalOwner=readOriginalOwner(path);owner=originalOwner.owner;originalOwnerUid=originalOwner.uid;
            // Keep the original following independent UID observation. A rich
            // owner read does not discharge this later temporal boundary.
            uid=uid(path);if(originalOwnerUid!=null&&uid!=originalOwnerUid.longValue())throw invalid();require(root);
        }
        void require(File root)throws VaultFailure {try{
            if(root==null||!path.equals(root.toPath())||!root.isAbsolute()
                ||!root.getAbsoluteFile().equals(root.getCanonicalFile())
                ||!key.equals(existingRootAttributes(path).fileKey())
                ||!sameOriginalOwner(path,owner,originalOwnerUid)||uid!=uid(path))throw invalid();
        }catch(Exception failure){throw invalid();}}
        void requireJournal(NativePrivateMutationEpochStore store)throws VaultFailure {
            require(path.toFile());if(store==null)throw invalid();store.requireSameNativeNoBackupRoot(path.toFile());
        }
    }
    static ExistingRoot observeExistingRoot(File root)throws VaultFailure {
        try{return new ExistingRoot(root);}catch(Exception failure){throw invalid();}
    }
    void requireSameNativeContext(Context context)throws VaultFailure {
        try{
            requireSameNativeNoBackupRoot(originalContextNoBackupRoot(context));
        }catch(Exception failure){throw invalid();}
    }
    void requireSameNativeNoBackupRoot(File actual)throws VaultFailure {
        try{
            if(actual==null||!actual.isAbsolute()||!actual.getAbsoluteFile().equals(actual.getCanonicalFile())
                ||!root.equals(actual.toPath()))throw invalid();
            requireBase();
        }catch(Exception failure){throw invalid();}
    }
    /** A live Engine token cannot adopt another original baseline. */
    void requireOriginalBaseline(VaultEngine.NativeOriginalMutationEpochBootstrap original)throws VaultFailure {
        if(original==null)throw invalid();original.requireCurrent();
        synchronized(COORDINATOR){try{
            requireBase();
            if(!baselineDigest(baselineBytes).equals(original.originalValuesSha256()))throw invalid();
            original.requireCurrent();requireBase();
        }catch(Exception failure){throw invalid();}}
    }
    /** Explicit owning all8 token only. The caller already holds its Engine
     * before we enter the native coordinator; no startup missing=>zero path. */
    static NativePrivateMutationEpochStore bootstrapFromContext(Context context,
        VaultEngine.NativeOriginalMutationEpochBootstrap token)throws VaultFailure {
        if(token==null||context==null)throw invalid();token.requireCurrent();
        try{
            var original=observeOriginalContextRoot(context);
            var store=bootstrapFromOriginalContext(original,token,null);
            original.requireCurrent();store.requireSameNativeContext(context);return store;
        }
        catch(Exception error){throw invalid();}
    }
    static NativePrivateMutationEpochStore bootstrapFromNativeNoBackupRoot(File root,
        VaultEngine.NativeOriginalMutationEpochBootstrap token)throws VaultFailure {
        if(token==null)throw invalid();token.requireCurrent();
        synchronized(COORDINATOR){try{
            var original=new Bootstrap(root,token);original.initialize();original.require();
            var store=new NativePrivateMutationEpochStore(root);
            try(var current=store.readCurrent()){if(current.counter()!=0)throw invalid();}
            original.require();return store;
        }catch(Exception error){throw invalid();}}
    }
    /** Shipping FIRST-baseline lifetime. The exact finite invocation is kept
     * by the private bootstrap, not replaced by a token-only fallback. */
    static NativePrivateMutationEpochStore bootstrapFromContext(Context context,
        VaultEngine.NativeOriginalMutationEpochBootstrap token,NativePrivateCustodyFrameReadControl invocation)throws VaultFailure {
        if(token==null||context==null||invocation==null)throw invalid();
        invocation.check();token.requireCurrent();invocation.check();
        try{
            var original=observeOriginalContextRoot(context);invocation.check();
            var store=bootstrapFromOriginalContext(original,token,invocation);invocation.check();
            original.requireCurrent();invocation.check();
            store.requireSameNativeContext(context);invocation.check();return store;
        }catch(Exception error){throw invalid();}
    }
    static NativePrivateMutationEpochStore bootstrapFromNativeNoBackupRoot(File root,
        VaultEngine.NativeOriginalMutationEpochBootstrap token,NativePrivateCustodyFrameReadControl invocation)throws VaultFailure {
        if(token==null||invocation==null)throw invalid();
        invocation.check();token.requireCurrent();invocation.check();
        synchronized(COORDINATOR){try{
            invocation.check();var original=new Bootstrap(root,token,invocation);original.initialize();original.require();
            var store=new NativePrivateMutationEpochStore(root);original.require();
            try(var current=store.readCurrent()){original.require();if(current.counter()!=0)throw invalid();}
            original.require();return store;
        }catch(Exception error){throw invalid();}}
    }
    private static NativePrivateMutationEpochStore bootstrapFromOriginalContext(ContextRoot original,
        VaultEngine.NativeOriginalMutationEpochBootstrap token,NativePrivateCustodyFrameReadControl invocation)throws VaultFailure {
        if(original==null||token==null)throw invalid();
        if(invocation!=null)invocation.check();token.requireCurrent();original.requireCurrent();
        synchronized(COORDINATOR){try{
            var bootstrap=new Bootstrap(original.path.toFile(),token,invocation,original);
            bootstrap.initialize();bootstrap.require();
            var store=new NativePrivateMutationEpochStore(original.path.toFile(),original);bootstrap.require();
            try(var current=store.readCurrent()){bootstrap.require();if(current.counter()!=0)throw invalid();}
            bootstrap.require();return store;
        }catch(Exception failure){throw invalid();}}
    }
    // Private fixed I/O seam only, using the same force-fault pattern as the
    // original operation store. No native/API caller can supply this object.
    private interface BootstrapIo {
        int write(FileChannel channel,ByteBuffer bytes)throws Exception;
        void forceFile(FileChannel channel)throws Exception;
        void forceDirectory(FileChannel channel)throws Exception;
        void removeMarker(Path marker)throws Exception;
    }
    private static BootstrapIo bootstrapIo=new BootstrapIo(){
        public int write(FileChannel channel,ByteBuffer bytes)throws Exception{return channel.write(bytes);}
        public void forceFile(FileChannel channel)throws Exception{channel.force(true);}
        public void forceDirectory(FileChannel channel)throws Exception{channel.force(true);}
        public void removeMarker(Path marker)throws Exception{Files.delete(marker);}
    };
    private static final class Bootstrap {
        final VaultEngine.NativeOriginalMutationEpochBootstrap token;
        private final NativePrivateCustodyFrameReadControl invocation;
        private final ContextRoot contextRoot;
        final Path root,dir,lock,baseline,current,marker;
        final Object rootKey;Object dirKey;
        final UserPrincipal owner;final String valuesDigest;
        final Map<Path,Object> identities=new HashMap<>();
        Bootstrap(File nativeRoot,VaultEngine.NativeOriginalMutationEpochBootstrap token)throws Exception {
            this(nativeRoot,token,null,null);
        }
        Bootstrap(File nativeRoot,VaultEngine.NativeOriginalMutationEpochBootstrap token,
            NativePrivateCustodyFrameReadControl invocation)throws Exception {
            this(nativeRoot,token,invocation,null);
        }
        Bootstrap(File nativeRoot,VaultEngine.NativeOriginalMutationEpochBootstrap token,
            NativePrivateCustodyFrameReadControl invocation,ContextRoot contextRoot)throws Exception {
            this.contextRoot=contextRoot;
            this.invocation=invocation;if(invocation!=null)invocation.check();
            this.token=token;token.requireCurrent();valuesDigest=token.originalValuesSha256();
            if(!valuesDigest.matches("[a-f0-9]{64}")||nativeRoot==null||!nativeRoot.isAbsolute()
                ||!nativeRoot.getAbsoluteFile().equals(nativeRoot.getCanonicalFile()))throw invalid();
            root=nativeRoot.toPath();requireRootDirectory(root,contextRoot);
            var rootAttributes=Files.readAttributes(root,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            rootKey=rootAttributes.fileKey();if(rootKey==null)throw invalid();owner=rootAttributes.owner();
            dir=root.resolve(DIRECTORY);lock=dir.resolve(LOCK);baseline=dir.resolve(BASELINE);current=dir.resolve(CURRENT);marker=dir.resolve(BOOTSTRAP);
            if(exists(dir)){requireDirectory(dir);dirKey=key(dir);}require();
        }
        void require()throws Exception {
            if(invocation!=null)invocation.check();
            token.requireCurrent();if(!valuesDigest.equals(token.originalValuesSha256()))throw invalid();
            requireRootDirectory(root,contextRoot);
            var rootAttributes=Files.readAttributes(root,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            if(!rootKey.equals(rootAttributes.fileKey())||!owner.equals(rootAttributes.owner()))throw invalid();
            if(dirKey!=null){requireDirectory(dir);
                var directoryAttributes=Files.readAttributes(dir,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                if(!dirKey.equals(directoryAttributes.fileKey())||!owner.equals(directoryAttributes.owner()))throw invalid();
                try(var files=Files.newDirectoryStream(dir)){for(Path path:files){if(!ARTIFACTS.contains(path.getFileName().toString()))throw invalid();privateFile(path,owner);}}
            }
            for(var entry:identities.entrySet())if(!entry.getValue().equals(key(entry.getKey())))throw invalid();
            if(invocation!=null)invocation.check();
        }
        void initialize()throws Exception {
            require();
            boolean created=dirKey==null;
            if(created){require();Files.createDirectory(dir,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));dirKey=key(dir);require();forceDirectory(root);}
            boolean empty;try(var files=Files.newDirectoryStream(dir)){empty=!files.iterator().hasNext();}
            if(empty&&!created)throw invalid();
            if(empty){writeFile(lock,new byte[0]);forceDirectory(dir);}
            else if(!exists(lock)||!exists(baseline)||!exists(current)||exists(dir.resolve(PENDING))||exists(dir.resolve(PREVIOUS)))throw invalid();
            identities.put(lock,key(lock));if(privateFile(lock,owner).size()!=0)throw invalid();require();
            try(FileChannel channel=FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);FileLock held=channel.tryLock()){
                if(held==null)throw invalid();require();initializeLocked(empty);require();
            }
        }
        void initializeLocked(boolean empty)throws Exception {
            if(!empty){
                // Only a complete immutable initial baseline can be retried.
                // Lock-only, partial, legacy counters and active transitions
                // remain preserved/unavailable rather than being completed.
                if(!exists(lock)||!exists(baseline)||!exists(current)||exists(dir.resolve(PENDING))||exists(dir.resolve(PREVIOUS)))throw invalid();
                for(Path path:new Path[]{lock,baseline,current})identities.put(path,key(path));
                if(privateFile(lock,owner).size()!=0)throw invalid();
                byte[] original=validatedBaseline(root,dir,owner);
                if(!baselineDigest(original).equals(valuesDigest)||!Arrays.equals(readFixed(current,RECORD_BYTES,owner),encode(0)))throw invalid();
                if(exists(marker)){
                    identities.put(marker,key(marker));if(!Arrays.equals(readFixed(marker,64,owner),markerBytes(original)))throw invalid();
                }
                forceFile(lock);forceFile(baseline);forceFile(current);forceDirectory(dir);forceDirectory(root);
                finishMarker();return;
            }
            // The baseline records its own real inode as well as native root,
            // directory, lock, UID name and original owning values digest.
            require();try(FileChannel channel=create(baseline)){
                identities.put(baseline,key(baseline));require();byte[] bytes=baselineEncoding(root,dir,owner,valuesDigest);
                write(channel,bytes);forceFile(channel);
            }require();forceDirectory(dir);
            byte[] original=validatedBaseline(root,dir,owner);
            writeFile(marker,markerBytes(original));forceDirectory(dir);
            writeFile(current,encode(0));forceDirectory(dir);forceDirectory(root);
            finishMarker();
        }
        void finishMarker()throws Exception {
            require();if(exists(marker)){
                if(!Arrays.equals(readFixed(marker,64,owner),markerBytes(validatedBaseline(root,dir,owner))))throw invalid();
                require();bootstrapIo.removeMarker(marker);identities.remove(marker);require();forceDirectory(dir);forceDirectory(root);
            }
            require();
        }
        FileChannel create(Path path)throws Exception {
            require();var channel=FileChannel.open(path,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
                PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
            try{identities.put(path,key(path));require();return channel;}catch(Exception failed){channel.close();throw failed;}
        }
        void writeFile(Path path,byte[] bytes)throws Exception {try(FileChannel channel=create(path)){write(channel,bytes);forceFile(channel);}require();}
        void write(FileChannel channel,byte[] bytes)throws Exception {
            var buffer=ByteBuffer.wrap(bytes);while(buffer.hasRemaining()){require();int count=bootstrapIo.write(channel,buffer);require();if(count<=0)throw invalid();}
        }
        void forceFile(FileChannel channel)throws Exception {require();bootstrapIo.forceFile(channel);require();}
        void forceFile(Path path)throws Exception {
            require();Object before=key(path);try(FileChannel channel=FileChannel.open(path,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){forceFile(channel);}
            require();if(!before.equals(key(path)))throw invalid();
        }
        void forceDirectory(Path path)throws Exception {
            require();try(FileChannel channel=FileChannel.open(path,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
                require();bootstrapIo.forceDirectory(channel);require();
            }require();
        }
    }
    private static byte[] baselineEncoding(Path root,Path dir,UserPrincipal owner,String digest)throws Exception {
        var output=new ByteArrayOutputStream();try(var data=new DataOutputStream(output)){
            data.writeInt(0x4d5a4231);data.writeInt(1);
            for(String text:new String[]{digest,key(root).toString(),key(dir).toString(),key(dir.resolve(LOCK)).toString(),key(dir.resolve(BASELINE)).toString(),owner.getName(),Long.toString(uid(root))}){
                if(text.length()>512)throw invalid();data.writeUTF(text);
            }
        }
        byte[] body=output.toByteArray();output.write(MessageDigest.getInstance("SHA-256").digest(body));return output.toByteArray();
    }
    private static String baselineDigest(byte[] bytes)throws Exception {
        if(bytes.length<80||bytes.length>4096)throw invalid();
        if(!MessageDigest.isEqual(Arrays.copyOfRange(bytes,bytes.length-32,bytes.length),MessageDigest.getInstance("SHA-256").digest(Arrays.copyOf(bytes,bytes.length-32))))throw invalid();
        try(var input=new DataInputStream(new ByteArrayInputStream(bytes,0,bytes.length-32))){
            if(input.readInt()!=0x4d5a4231||input.readInt()!=1)throw invalid();String digest=input.readUTF();if(!digest.matches("[a-f0-9]{64}"))throw invalid();
            for(int i=0;i<6;i++)if(input.readUTF().length()>512)throw invalid();if(input.read()!=-1)throw invalid();return digest;
        }
    }
    private static byte[] validatedBaseline(Path root,Path dir,UserPrincipal owner)throws Exception {
        Path path=dir.resolve(BASELINE);long size=privateFile(path,owner).size();if(size<80||size>4096)throw invalid();
        byte[] bytes=readFixed(path,(int)size,owner);String digest=baselineDigest(bytes);
        if(!Arrays.equals(bytes,baselineEncoding(root,dir,owner,digest)))throw invalid();return bytes;
    }
    private static byte[] markerBytes(byte[] baseline)throws Exception {
        byte[] bytes=new byte[64];System.arraycopy(MessageDigest.getInstance("SHA-256").digest(baseline),0,bytes,0,32);
        System.arraycopy(MessageDigest.getInstance("SHA-256").digest(encode(0)),0,bytes,32,32);return bytes;
    }
    private static PosixFileAttributes privateFile(Path path,UserPrincipal owner)throws Exception {
        var attributes=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!attributes.isRegularFile()||attributes.isSymbolicLink()||attributes.fileKey()==null
            ||!attributes.permissions().equals(PosixFilePermissions.fromString("rw-------"))
            ||!owner.equals(attributes.owner()))throw invalid();return attributes;
    }
    /** Public VM defining-loader identity, not names, mutable properties or
     * default-provider identity alone. Application-defined providers/principals
     * retain the original full comparison. The fixed factory uses File.toPath.
     * Trusted core platform classes are the same boundary as java.nio.Files. */
    private static boolean coreNativeOwner(Path path,UserPrincipal owner) {
        try{
            ClassLoader core=Object.class.getClassLoader();
            if(Files.class.getClassLoader()!=core)return false;
            var provider=path.getFileSystem().provider();
            return "file".equals(provider.getScheme())
                &&provider.getClass().getClassLoader()==core
                &&owner.getClass().getClassLoader()==core;
        }catch(SecurityException unavailable){return false;}
    }
    /** Immutable principal identity only, never a root/currentness verdict. */
    private static final class OriginalOwner {
        private final UserPrincipal owner;private final Long uid;
        private OriginalOwner(UserPrincipal owner,Long uid){this.owner=owner;this.uid=uid;}
    }
    private static boolean coreNativePath(Path path) {
        try{
            ClassLoader core=Object.class.getClassLoader();
            var provider=path.getFileSystem().provider();
            return Files.class.getClassLoader()==core&&"file".equals(provider.getScheme())
                &&provider.getClass().getClassLoader()==core;
        }catch(SecurityException unavailable){return false;}
    }
    /** Replaces exactly the original owner-read position with one rich stat.
     * The following independent UID read in ExistingRoot is still mandatory. */
    private static OriginalOwner readOriginalOwner(Path path)throws Exception {
        if(!coreNativePath(path))return new OriginalOwner(Files.getOwner(path,LinkOption.NOFOLLOW_LINKS),null);
        var values=Files.readAttributes(path,"unix:owner,uid",LinkOption.NOFOLLOW_LINKS);
        Object principal=values.get("owner");if(!(principal instanceof UserPrincipal))throw invalid();
        var owner=(UserPrincipal)principal;
        return new OriginalOwner(owner,coreNativeOwner(path,owner)?uidValue(values.get("uid")):null);
    }
    /** Same fresh observation position as the old getOwner. Keep the next
     * fresh UID read too: neither one can satisfy the other's race check. */
    private static boolean sameOriginalOwner(Path path,UserPrincipal owner,Long originalUid)throws Exception {
        if(originalUid==null||!coreNativeOwner(path,owner))
            return owner.equals(Files.getOwner(path,LinkOption.NOFOLLOW_LINKS));
        return originalUid.longValue()==uid(path);
    }
    private static final String NATIVE_ATTRIBUTES="unix:uid,mode,size,lastModifiedTime,lastAccessTime,creationTime,fileKey";
    /** The expected UID is bound to the ORIGINAL principal in the SAME fresh
     * native stat, with the original root inode/mode checked before use. */
    private static Long originalNativeUid(Path root,UserPrincipal owner,Object rootKey)throws Exception {
        if(!coreNativeOwner(root,owner))return null;
        var values=Files.readAttributes(root,NATIVE_ATTRIBUTES+",owner",LinkOption.NOFOLLOW_LINKS);
        var attributes=new NativeAttributes(values);
        Object observed=values.get("owner");
        if(!(observed instanceof UserPrincipal)||!coreNativeOwner(root,(UserPrincipal)observed)
            ||!owner.equals(observed)||!rootKey.equals(attributes.fileKey())
            ||!attributes.isDirectory()||(attributes.mode&0777)!=0700)throw invalid();
        return attributes.uid;
    }
    /** One fresh native stat, with NO owner/group name lookup. AOSP/OpenJDK
     * fromUid(st_uid) is a non-group principal; its equality for nonnegative
     * UIDs is exactly UID equality. No snapshot escapes this read boundary. */
    private static NativeAttributes nativeAttributes(Path path,UserPrincipal owner,Long originalUid)throws Exception {
        if(originalUid==null||!coreNativeOwner(path,owner))return null;
        var attributes=new NativeAttributes(Files.readAttributes(path,NATIVE_ATTRIBUTES,LinkOption.NOFOLLOW_LINKS));
        if(attributes.uid!=originalUid.longValue())throw invalid();return attributes;
    }
    // Deliberately BasicFileAttributes: never manufacture a Posix owner getter.
    private static final class NativeAttributes implements BasicFileAttributes {
        final long uid;final int mode;private final long size;
        private final Object key;
        private final java.nio.file.attribute.FileTime modified,accessed,created;
        NativeAttributes(Map<String,Object> values)throws Exception {
            uid=uidValue(values.get("uid"));
            if(!(values.get("mode") instanceof Integer)||!(values.get("size") instanceof Long)
                ||!(values.get("lastModifiedTime") instanceof java.nio.file.attribute.FileTime)
                ||!(values.get("lastAccessTime") instanceof java.nio.file.attribute.FileTime)
                ||!(values.get("creationTime") instanceof java.nio.file.attribute.FileTime)
                ||values.get("fileKey")==null)throw invalid();
            mode=(Integer)values.get("mode");size=(Long)values.get("size");key=values.get("fileKey");
            modified=(java.nio.file.attribute.FileTime)values.get("lastModifiedTime");
            accessed=(java.nio.file.attribute.FileTime)values.get("lastAccessTime");
            created=(java.nio.file.attribute.FileTime)values.get("creationTime");
        }
        public java.nio.file.attribute.FileTime lastModifiedTime(){return modified;}
        public java.nio.file.attribute.FileTime lastAccessTime(){return accessed;}
        public java.nio.file.attribute.FileTime creationTime(){return created;}
        public boolean isRegularFile(){return(mode&0170000)==0100000;}
        public boolean isDirectory(){return(mode&0170000)==0040000;}
        public boolean isSymbolicLink(){return(mode&0170000)==0120000;}
        public boolean isOther(){return !isRegularFile()&&!isDirectory()&&!isSymbolicLink();}
        public long size(){return size;}
        public Object fileKey(){return key;}
    }
    private static BasicFileAttributes privateFile(Path path,UserPrincipal owner,Long originalUid)throws Exception {
        var attributes=nativeAttributes(path,owner,originalUid);
        if(attributes==null)return privateFile(path,owner); // unchanged full comparison
        if(!attributes.isRegularFile()||attributes.isSymbolicLink()||attributes.fileKey()==null
            ||(attributes.mode&0777)!=0600)throw invalid();return attributes;
    }
    private static byte[] readFixed(Path path,int size,UserPrincipal owner)throws Exception {
        return readFixed(path,size,owner,null);
    }
    /** The live baseline caller additionally pins the actual file read to its
     * constructor-observed inode, not merely equal pre/post successor inodes. */
    private static byte[] readFixed(Path path,int size,UserPrincipal owner,Object originalKey)throws Exception {
        return readFixed(path,size,owner,originalKey,null);
    }
    private static byte[] readFixed(Path path,int size,UserPrincipal owner,Object originalKey,Long originalUid)throws Exception {
        var before=privateFile(path,owner,originalUid);if(before.size()!=size)throw invalid();byte[] bytes=new byte[size];
        if(originalKey!=null&&!originalKey.equals(before.fileKey()))throw invalid();
        try(FileChannel input=FileChannel.open(path,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            if(input.size()!=size)throw invalid();ByteBuffer buffer=ByteBuffer.wrap(bytes);while(buffer.hasRemaining())if(input.read(buffer)<=0)throw invalid();
            if(input.read(ByteBuffer.allocate(1))!=-1)throw invalid();var after=privateFile(path,owner,originalUid);
            if(!before.fileKey().equals(after.fileKey())||!before.lastModifiedTime().equals(after.lastModifiedTime())||after.size()!=size
                ||originalKey!=null&&!originalKey.equals(after.fileKey()))throw invalid();return bytes;
        }
    }
    /** Platform adapter only: every invocation still makes one independent
     * NOFOLLOW lstat at this exact UID-observation position. No stat, UID,
     * identity verdict or positive filesystem result is retained. */
    private static long uid(Path path)throws Exception {
        if(publicAndroidUidPath(path))
            // No fallback after selecting the actual platform read: errno,
            // permission, security and linkage failures remain refusals.
            // Both Android stat APIs expose st_uid as the SAME signed int.
            return uidValue(android.system.Os.lstat(path.toString()).st_uid);
        return uidValue(Files.getAttribute(path,"unix:uid",LinkOption.NOFOLLOW_LINKS));
    }
    /** Unsupported host/custom paths retain the original provider operation.
     * A wrapper can advertise the real filesystem yet be rejected by its
     * provider; it must never be converted into a native path string here.
     * Non-round-tripping native byte paths and relative paths also keep the
     * original provider semantics. Only absent Android API selection is caught. */
    private static boolean publicAndroidUidPath(Path path) {
        if(!coreNativePath(path)||path.getClass().getClassLoader()!=Object.class.getClassLoader()
            ||!path.isAbsolute()||!path.equals(path.getFileSystem().getPath(path.toString())))return false;
        try{return android.system.Os.class.getClassLoader()==Object.class.getClassLoader();}
        catch(NoClassDefFoundError unsupportedHost){return false;}
    }
    private static long uidValue(Object value)throws Exception {
        if(!(value instanceof Integer)&&!(value instanceof Long))throw invalid();long uid=((Number)value).longValue();
        if(uid<0||uid>0xffff_ffffL)throw invalid();return uid;
    }
    static final class Current implements AutoCloseable {
        private final NativePrivateMutationEpochStore store;
        private final Object directoryKey,lockKey,fileKey;
        private byte[] bytes;private final long counter;private final HeldOriginal held;
        private Current(NativePrivateMutationEpochStore store,Record record)throws Exception {
            this.store=store;directoryKey=key(store.directory);lockKey=key(store.lock);fileKey=record.key;
            bytes=record.bytes.clone();counter=record.counter;held=record.held;
        }
        long counter()throws VaultFailure{requireOpen();return counter;}
        HeldOriginal heldOriginal()throws VaultFailure{requireOpen();return held;}
        private void requireOpen()throws VaultFailure{if(bytes==null)throw invalid();}
        @Override public void close(){if(bytes!=null)Arrays.fill(bytes,(byte)0);bytes=null;}
    }
    /** Immutable retained metadata only. Neither this value nor a digest is
     * admission, source authentication, ACK or a thaw capability. */
    static final class HeldOriginal {
        final long originalCounter;
        final String originalValuesSha256,originalGenerationId,originalOperationId,originalPlanSha256;
        final String browserFrameSha256,browserPartSetSha256;
        private final String inode,predecessorInode,predecessorSha256,baselineSha256;
        private HeldOriginal(long counter,String inode,String predecessorInode,String predecessorSha256,
            String baselineSha256,String values,String generation,String operation,String plan)throws Exception {
            this(counter,inode,predecessorInode,predecessorSha256,baselineSha256,values,generation,operation,plan,null,null);
        }
        private HeldOriginal(long counter,String inode,String predecessorInode,String predecessorSha256,
            String baselineSha256,String values,String generation,String operation,String plan,
            String browserFrameSha256,String browserPartSetSha256)throws Exception {
            if((browserFrameSha256==null)!=(browserPartSetSha256==null))throw invalid();
            if(browserFrameSha256!=null&&(!browserFrameSha256.matches("[a-f0-9]{64}")
                ||!browserPartSetSha256.matches("[a-f0-9]{64}")))throw invalid();
            if(counter<0||counter==Long.MAX_VALUE||inode==null||inode.isEmpty()||inode.length()>512
                ||predecessorInode==null||predecessorInode.isEmpty()||predecessorInode.length()>512)throw invalid();
            for(String digest:new String[]{predecessorSha256,baselineSha256,values,plan})
                if(digest==null||!digest.matches("[a-f0-9]{64}"))throw invalid();
            if(!NativeNfcOriginalWriteAttempt.uuid(generation).equals(generation)
                ||!NativeNfcOriginalWriteAttempt.uuid(operation).equals(operation))throw invalid();
            originalCounter=counter;this.inode=inode;this.predecessorInode=predecessorInode;
            this.predecessorSha256=predecessorSha256;this.baselineSha256=baselineSha256;
            originalValuesSha256=values;originalGenerationId=generation;originalOperationId=operation;originalPlanSha256=plan;
            this.browserFrameSha256=browserFrameSha256;this.browserPartSetSha256=browserPartSetSha256;
        }
    }
    static final class Prepared implements AutoCloseable {
        private final NativePrivateMutationEpochStore store;
        private final Object directoryKey,lockKey,predecessorKey,candidateKey;
        private byte[] predecessor,candidate;private final long from,to;
        private Prepared(NativePrivateMutationEpochStore store,State state)throws Exception {
            this.store=store;directoryKey=key(store.directory);lockKey=key(store.lock);
            predecessorKey=state.old.key;candidateKey=state.next.key;
            predecessor=state.old.bytes.clone();candidate=state.next.bytes.clone();from=state.old.counter;to=state.next.counter;
        }
        long predecessorCounter()throws VaultFailure{requireOpen();return from;}
        long nextCounter()throws VaultFailure{requireOpen();return to;}
        private void requireOpen()throws VaultFailure{if(candidate==null||predecessor==null)throw invalid();}
        @Override public void close(){if(candidate!=null)Arrays.fill(candidate,(byte)0);if(predecessor!=null)Arrays.fill(predecessor,(byte)0);candidate=null;predecessor=null;}
    }
    private static final class Record {
        final byte[] bytes;final Object key;final long predecessor,counter;
        final HeldOriginal held;
        Record(byte[] bytes,Object key)throws Exception {
            if(bytes.length<RECORD_BYTES||bytes.length>MAX_HELD_RECORD_BYTES)throw invalid();
            var buffer=ByteBuffer.wrap(bytes);if(buffer.getInt()!=MAGIC)throw invalid();int version=buffer.getInt();
            predecessor=buffer.getLong();counter=buffer.getLong();
            if(counter<0||predecessor!=(counter==0?-1:counter-1))throw invalid();
            if(version==1){
                if(bytes.length!=RECORD_BYTES)throw invalid();held=null;
            }else if(version==2||version==3){
                try(var input=new DataInputStream(new ByteArrayInputStream(bytes,24,bytes.length-56))){
                    held=new HeldOriginal(predecessor,input.readUTF(),input.readUTF(),input.readUTF(),input.readUTF(),
                        input.readUTF(),input.readUTF(),input.readUTF(),input.readUTF(),
                        version==3?input.readUTF():null,version==3?input.readUTF():null);
                    if(input.read()!=-1||!held.inode.equals(key.toString()))throw invalid();
                }
                if(!Arrays.equals(bytes,encodeHeld(held)))throw invalid();
            }else throw invalid();
            if(!MessageDigest.isEqual(Arrays.copyOfRange(bytes,bytes.length-32,bytes.length),MessageDigest.getInstance("SHA-256").digest(Arrays.copyOf(bytes,bytes.length-32))))throw invalid();
            this.bytes=bytes;this.key=key;
        }
    }
    private static final class State {
        final Record old,next;final boolean promoted,pendingPresent;
        State(Record old,Record next,boolean promoted,boolean pendingPresent){this.old=old;this.next=next;this.promoted=promoted;this.pendingPresent=pendingPresent;}
    }
    Current readCurrent()throws VaultFailure {
        synchronized(COORDINATOR){try{
            requireBase();try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                if(held==null)throw invalid();requireBase();
                if(exists(pending)||exists(previous))throw invalid();
                Record record=read(current);return new Current(this,record);
            }
        }catch(Exception error){throw invalid();}}
    }
    void requireCurrent(Current expected)throws VaultFailure {
        synchronized(COORDINATOR){try{
            // This synchronous read owns one lock for its entire boundary.
            // openLock validates the full live base BEFORE opening it; do not
            // repeat that graph merely to inspect the private handle first.
            if(expected==null||expected.store!=this)throw invalid();expected.requireOpen();
            if(originalEnrollmentCommit!=null){originalEnrollmentCommit.requireExpected(expected);return;}
            try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                if(held==null||!held.isValid()||held.channel()!=channel)throw invalid();
                if(!expected.directoryKey.equals(key(directory))||!expected.lockKey.equals(key(lock)))throw invalid();
                requireExactCurrent(expected);
                // A fresh full root/directory/lock/baseline/artifact check
                // AFTER the exact file read, never a cached pre-read result.
                requireCurrentHandle(expected);
                requireExactCurrent(expected); // exact original through terminal base I/O
                if(exists(pending)||exists(previous)||!held.isValid()||held.channel()!=channel)throw invalid();
            }
        }catch(Exception error){
            // Revocation is lifetime-local: never alter metadata or close a
            // foreign store's token. A trusted read/recovery must mint a new
            // fully validated handle after any owning refusal.
            if(expected!=null&&expected.store==this)expected.close();throw invalid();
        }catch(Error error){
            if(expected!=null&&expected.store==this)expected.close();throw error;
        }}
    }
    /** Ordinary admission NEVER uses the private preservation-read loan. */
    void requireOrdinaryAdmission(Current expected)throws VaultFailure {
        synchronized(COORDINATOR){try{
            if(originalHoldReadLoan!=null||originalEnrollmentCommit!=null||ordinaryExternalWrite!=null)throw invalid();
            requireCurrentHandle(expected);requireExactCurrent(expected);
            if(expected.held!=null)throw invalid();
        }catch(Exception failure){throw invalid();}}
    }
    long counterForPreservationRead(Current expected)throws VaultFailure {
        synchronized(COORDINATOR){try{
            if(originalHoldReadLoan!=null){originalHoldReadLoan.require(expected);return expected.counter;}
            requireCurrent(expected);return expected.counter();
        }catch(Exception failure){throw invalid();}}
    }
    /** One synchronous fixed enrollment commit while retaining the actual
     * existing HELD epoch FileLock. This is neither an ordinary write lease nor
     * a generic callback: only its original persistence/control pair can act.
     * No counter, record, root, phase or baseline is changed by this loan. */
    static final class OriginalEnrollmentCommit implements AutoCloseable {
        private final NativePrivateMutationEpochStore store;
        private final Current original;
        private final FileChannel channel;
        private final FileLock heldLock;
        private final VaultPersistence target;
        private final VaultEngine.NativeOriginalInventoryFinalizationControl control;
        private final Thread thread=Thread.currentThread();
        private boolean closed;
        private OriginalEnrollmentCommit(NativePrivateMutationEpochStore store,Current original,
            FileChannel channel,FileLock heldLock,VaultPersistence target,
            VaultEngine.NativeOriginalInventoryFinalizationControl control){
            this.store=store;this.original=original;this.channel=channel;this.heldLock=heldLock;
            this.target=target;this.control=control;
        }
        private void requireExpected(Current expected)throws VaultFailure {
            try{
                if(closed||Thread.currentThread()!=thread||!Thread.holdsLock(COORDINATOR)
                    ||expected!=original||expected.store!=store||store.originalEnrollmentCommit!=this
                    ||store.originalHoldReadLoan!=null||original.held==null||!heldLock.isValid()
                    ||heldLock.channel()!=channel||!channel.isOpen())throw invalid();
                AndroidProtectedWorkPreferences.requireInstalledMutationEpochJournal(store,original);
                control.requireInstalledHeldEpoch(store,original,target);
                store.requireCurrentHandle(original);store.requireExactCurrent(original);
                if(exists(store.pending)||exists(store.previous)||!heldLock.isValid())throw invalid();
            }catch(VaultFailure failure){throw failure;}catch(Exception failure){throw invalid();}
        }
        void requireForPersistence(VaultPersistence expected,VaultEngine.NativeOriginalInventoryFinalizationControl issuer)throws VaultFailure {
            if(expected!=target||issuer!=control)throw invalid();requireExpected(original);
        }
        @Override public void close(){
            closed=true;
            if(store.originalEnrollmentCommit==this)store.originalEnrollmentCommit=null;
            // The calling scope owns channel/lock and closes them after us.
        }
    }
    void requireOriginalEnrollmentCommit(Current expected,VaultPersistence target,
        VaultEngine.NativeOriginalInventoryFinalizationControl control)throws VaultFailure {
        synchronized(COORDINATOR){
            if(originalEnrollmentCommit==null)throw invalid();
            originalEnrollmentCommit.requireForPersistence(target,control);
            if(expected!=originalEnrollmentCommit.original)throw invalid();
        }
    }
    void commitOriginalEnrollment(Current expected,VaultPersistence target,
        VaultEngine.NativeOriginalInventoryFinalizationControl control)throws VaultFailure {
        synchronized(COORDINATOR){try{
            if(expected==null||expected.store!=this||target==null||control==null
                ||originalHoldReadLoan!=null||originalEnrollmentCommit!=null)throw invalid();
            expected.requireOpen();if(expected.held==null)throw invalid();
            // Validate before opening this second lock. All actual source/
            // receipt checks run again under the private same-thread loan.
            requireCurrent(expected);control.requireBeforeCommit();
            try(FileChannel channel=openLock();FileLock lock=channel.tryLock()){
                if(lock==null||!lock.isValid()||lock.channel()!=channel)throw invalid();
                requireCurrentHandle(expected);requireExactCurrent(expected);
                if(exists(pending)||exists(previous))throw invalid();
                var loan=new OriginalEnrollmentCommit(this,expected,channel,lock,target,control);
                originalEnrollmentCommit=loan;
                try(loan){
                    loan.requireForPersistence(target,control);control.requireBeforeCommit();
                    target.commitOriginalInventoryFinalizationUnderHeldEpoch(control,loan);
                    loan.requireForPersistence(target,control);
                }
            }
            requireCurrent(expected);
        }catch(VaultFailure failure){throw failure;}catch(Exception failure){throw invalid();}}
    }
    /** DATA result of one fully completed fixed ordinary epoch scope. */
    static final class OrdinaryExternalWriteResult<T> {
        final Current current;final T value;
        private OrdinaryExternalWriteResult(Current current,T value){this.current=current;this.value=value;}
    }
    private final class OrdinaryExternalWrite {
        final Current original;final FileChannel channel;final FileLock held;
        final Thread thread=Thread.currentThread();
        final Path marker=directory.resolve(EXTERNAL_UNKNOWN);
        final byte[] markerBytes;
        Object markerKey;
        OrdinaryExternalWrite(Current original,FileChannel channel,FileLock held)throws Exception {
            this.original=original;this.channel=channel;this.held=held;
            var output=new ByteArrayOutputStream();
            try(var data=new DataOutputStream(output)){
                data.writeInt(0x4d5a5831);data.writeInt(1);data.writeLong(original.counter);
                data.writeLong(original.counter+1);String inode=original.fileKey.toString();
                if(inode.length()>512)throw invalid();data.writeUTF(inode);
                data.writeInt(original.bytes.length);data.write(original.bytes);data.writeUTF(sha256(baselineBytes));
            }
            output.write(MessageDigest.getInstance("SHA-256").digest(output.toByteArray()));
            markerBytes=output.toByteArray();if(markerBytes.length>2048)throw invalid();
        }
        void requireScope()throws Exception {
            if(ordinaryExternalWrite!=this||Thread.currentThread()!=thread||!Thread.holdsLock(COORDINATOR)
                ||originalHoldReadLoan!=null||originalEnrollmentCommit!=null)throw invalid();
            original.requireOpen();
        }
        void requireHeld()throws Exception {
            requireScope();
            if(!channel.isOpen()||!held.isValid()||held.channel()!=channel)throw invalid();
        }
        void requireMarker()throws Exception {
            if(markerKey==null||!Arrays.equals(markerBytes,
                readFixed(marker,markerBytes.length,owner,markerKey,ownerUid)))throw invalid();
        }
        void requireOriginal()throws Exception {
            requireExternalBase(this);requireExactCurrent(original);
            if(original.held!=null||exists(pending)||exists(previous))throw invalid();
        }
        void requireTerminal(Current result)throws Exception {
            requireExternalBase(this);
            if(result==null||result.store!=NativePrivateMutationEpochStore.this
                ||result.counter!=original.counter+1||result.held!=null||exists(pending)||exists(previous))throw invalid();
            result.requireOpen();Record actual=read(current);
            if(!result.fileKey.equals(actual.key)||!Arrays.equals(result.bytes,actual.bytes))throw invalid();
            requireExternalBase(this);
        }
    }
    /** The callback is the exact owning external primitive; a false result
     * must be converted to VaultFailure by that owner. No retry/recovery of its
     * durable UNKNOWN is ever inferred from an epoch candidate. */
    <T> OrdinaryExternalWriteResult<T> commitOrdinaryExternalWrite(Current expected,
        AndroidProtectedWorkPreferences.OrdinaryWorkProtection<T> effect)throws VaultFailure {
        synchronized(COORDINATOR){
            OrdinaryExternalWrite scope=null;Current result=null;boolean returned=false;
            try{
                if(effect==null||ordinaryExternalWrite!=null||originalHoldReadLoan!=null||originalEnrollmentCommit!=null)
                    throw invalid();
                requireCurrentHandle(expected);requireExactCurrent(expected);
                if(expected.held!=null||expected.counter==Long.MAX_VALUE)throw invalid();
                T value;
                try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                    if(held==null||!held.isValid()||held.channel()!=channel)throw invalid();
                    requireCurrentHandle(expected);requireExactCurrent(expected);
                    if(expected.held!=null||exists(pending)||exists(previous))throw invalid();
                    scope=new OrdinaryExternalWrite(expected,channel,held);ordinaryExternalWrite=scope;
                    // Absent-only, exact original marker is forced BEFORE the
                    // external callback, even if that callback later throws.
                    try(FileChannel output=FileChannel.open(scope.marker,
                        Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
                        PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
                        scope.markerKey=key(scope.marker);ByteBuffer buffer=ByteBuffer.wrap(scope.markerBytes);
                        long start=System.nanoTime();
                        while(buffer.hasRemaining()){
                            if(System.nanoTime()-start>30_000_000_000L||output.write(buffer)<=0)throw invalid();
                        }
                        io.forceFile(output);
                    }
                    forceExternalDirectory(scope);scope.requireOriginal();
                    value=effect.protect();
                    scope.requireOriginal();
                    byte[] next=encode(expected.counter+1);
                    try{
                        pendingWriter.write(next);forceExternalDirectory(scope);scope.requireHeld();
                        Record candidate=read(pending);
                        if(!Arrays.equals(next,candidate.bytes))throw invalid();
                        State staged=externalState(scope);
                        if(staged.promoted||!staged.old.key.equals(expected.fileKey)
                            ||!Arrays.equals(staged.old.bytes,expected.bytes)
                            ||!staged.next.key.equals(candidate.key)||!Arrays.equals(staged.next.bytes,next))throw invalid();
                        try(var prepared=new Prepared(this,staged)){
                            result=commitExternalPrepared(scope,prepared);
                        }
                    }finally{Arrays.fill(next,(byte)0);}
                    scope.requireTerminal(result);
                }
                // Keep UNKNOWN through lock/channel closure as well. Those
                // failures must not turn an unknown external effect into a
                // recoverable ordinary epoch transaction.
                scope.requireScope();
                if(scope.channel.isOpen()||scope.held.isValid())throw invalid();
                requireExternalBaseContents(scope);
                if(exists(pending)||exists(previous))throw invalid();
                Record terminal=read(current);
                if(!result.fileKey.equals(terminal.key)||!Arrays.equals(result.bytes,terminal.bytes))throw invalid();
                scope.requireMarker();
                var completed=new OrdinaryExternalWriteResult<T>(result,value);
                expected.close();
                // LAST fallible action. Removal is not credited as crash-proof:
                // a marker revived after crash remains UNKNOWN, never replayed.
                // No force/read/recovery after unlink can fail with it absent.
                Files.delete(scope.marker);
                returned=true;return completed;
            }catch(VaultFailure failure){throw failure;}
            catch(Exception failure){throw new VaultFailure(FAILURE,failure);}
            finally{
                if(expected!=null&&expected.store==this)expected.close();
                if(!returned&&result!=null)result.close();
                if(scope!=null){
                    if(ordinaryExternalWrite==scope)ordinaryExternalWrite=null;
                    Arrays.fill(scope.markerBytes,(byte)0);
                }
            }
        }
    }
    private void requireExternalBase(OrdinaryExternalWrite scope)throws Exception {
        if(scope==null)throw invalid();scope.requireHeld();requireExternalBaseContents(scope);scope.requireHeld();
    }
    /** Closed original scope only; never a public bypass of requireBase().
     * All normal readers/prepare/recovery/hold reject this unknown artifact. */
    private void requireExternalBaseContents(OrdinaryExternalWrite scope)throws Exception {
        scope.requireScope();String[] fields=originalBaselineFields();requireBaseIdentities(fields);
        scope.requireMarker();
        byte[] observed=readFixed(directory.resolve(BASELINE),baselineBytes.length,owner,baselineKey,ownerUid);
        try{
            if(!Arrays.equals(baselineBytes,observed))throw invalid();
            int count=0;boolean markerSeen=false;
            try(var paths=Files.newDirectoryStream(directory)){
                for(Path path:paths){
                    String name=path.getFileName().toString();
                    if(++count>ARTIFACTS.size()+1||BOOTSTRAP.equals(name))throw invalid();
                    if(EXTERNAL_UNKNOWN.equals(name)){
                        if(markerSeen)throw invalid();markerSeen=true;scope.requireMarker();
                    }else if(!ARTIFACTS.contains(name))throw invalid();
                    requireFile(path);
                }
            }
            if(!markerSeen||requireFile(lock).size()!=0)throw invalid();
            for(Path path:new Path[]{lock,directory.resolve(BASELINE),current,pending,previous}){
                if(exists(path)&&Files.isSameFile(scope.marker,path))throw invalid();
            }
            for(Path path:new Path[]{current,pending,previous})if(exists(path)&&Files.isSameFile(lock,path))throw invalid();
            requireBaseIdentities(fields);scope.requireMarker();scope.requireScope();
        }finally{Arrays.fill(observed,(byte)0);}
    }
    private void forceExternalDirectory(OrdinaryExternalWrite scope)throws Exception {
        requireExternalBase(scope);
        try(FileChannel channel=FileChannel.open(directory,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            io.forceDirectory(channel);
        }
        requireExternalBase(scope);
    }
    private State externalState(OrdinaryExternalWrite scope)throws Exception {
        requireExternalBase(scope);State result=stateRecords();requireExternalBase(scope);return result;
    }
    private Current commitExternalPrepared(OrdinaryExternalWrite scope,Prepared expected)throws Exception {
        scope.requireHeld();expected.requireOpen();
        if(expected.store!=this||!expected.directoryKey.equals(directoryKey)||!expected.lockKey.equals(lockKey))throw invalid();
        State actual=externalState(scope);requireSame(expected,actual);
        forceRecord(actual.pendingPresent?pending:current,actual.next);forceExternalDirectory(scope);
        requireSame(expected,externalState(scope));
        if(!actual.promoted){
            if(!exists(previous)){publishCounterRecord(expected,scope.channel,scope.held,true,scope);forceExternalDirectory(scope);requireSame(expected,externalState(scope));}
            if(exists(current)){
                if(!Files.isSameFile(current,previous))throw invalid();
                forceRecord(previous,actual.old);forceExternalDirectory(scope);requireSame(expected,externalState(scope));
                io.unlinkPredecessorCurrent();forceExternalDirectory(scope);requireSame(expected,externalState(scope));
            }
            publishCounterRecord(expected,scope.channel,scope.held,false,scope);forceExternalDirectory(scope);requireSame(expected,externalState(scope));
        }
        actual=externalState(scope);requireSame(expected,actual);if(!actual.promoted)throw invalid();
        forceRecord(current,actual.next);forceExternalDirectory(scope);requireSame(expected,externalState(scope));
        if(exists(pending)){io.unlinkPending();forceExternalDirectory(scope);requireSame(expected,externalState(scope));}
        io.unlinkPrevious();forceExternalDirectory(scope);
        if(exists(pending)||exists(previous))throw invalid();
        Record record=read(current);
        if(!record.key.equals(expected.candidateKey)||!Arrays.equals(record.bytes,expected.candidate))throw invalid();
        return new Current(this,record);
    }
    private enum OriginalHoldReadPhase { PRE_INTENT, PENDING }
    private final class OriginalHoldReadLoan implements AutoCloseable {
        private final Thread thread=Thread.currentThread();
        private final Current original;private final Record candidate;private final FileLock heldLock;
        private final HeldOriginal binding;
        private final OriginalHoldReadPhase phase;
        private OriginalHoldReadLoan(Current original,FileLock heldLock)throws Exception {
            this(original,null,heldLock,null,OriginalHoldReadPhase.PRE_INTENT);
        }
        private OriginalHoldReadLoan(Current original,Record candidate,FileLock heldLock,HeldOriginal binding)throws Exception {
            this(original,candidate,heldLock,binding,OriginalHoldReadPhase.PENDING);
        }
        private OriginalHoldReadLoan(Current original,Record candidate,FileLock heldLock,HeldOriginal binding,
            OriginalHoldReadPhase phase)throws Exception {
            this.original=original;this.candidate=candidate;this.heldLock=heldLock;this.binding=binding;
            this.phase=phase;
            require(original);
        }
        private void require(Current expected)throws Exception {
            if(thread!=Thread.currentThread()||!Thread.holdsLock(COORDINATOR)||!heldLock.isValid()
                ||originalHoldReadLoan!=null&&originalHoldReadLoan!=this||expected!=original)throw invalid();
            AndroidProtectedWorkPreferences.requireInstalledMutationEpochJournal(NativePrivateMutationEpochStore.this,original);
            requireCurrentHandle(original);if(original.held!=null)throw invalid();
            Record old=read(current);
            if(!old.key.equals(original.fileKey)||!Arrays.equals(old.bytes,original.bytes))throw invalid();
            if(phase==OriginalHoldReadPhase.PRE_INTENT){
                if(candidate!=null||binding!=null||exists(pending)||exists(previous))throw invalid();return;
            }
            if(candidate==null||binding==null)throw invalid();Record next=read(pending);
            if(!next.key.equals(candidate.key)||!Arrays.equals(next.bytes,candidate.bytes)
                ||!Arrays.equals(next.bytes,encodeHeld(binding)))throw invalid();
            if(exists(previous)&&(!Files.isSameFile(previous,current)
                ||!Arrays.equals(read(previous).bytes,original.bytes)))throw invalid();
            requireHeldPredecessor(old,next);
        }
        @Override public void close(){if(originalHoldReadLoan==this)originalHoldReadLoan=null;}
    }
    /** Only the SAME installed journal/Current can transfer into durable HELD.
     * The private read loan is exact pending readback, never writer admission. */
    Current holdOriginalWriters(Current expected,VaultEngine.NativeOriginalDurableWriterHold token)throws VaultFailure {
        if(token==null)throw invalid();token.requireCurrent();
        synchronized(COORDINATOR){try{
            AndroidProtectedWorkPreferences.requireInstalledMutationEpochJournal(this,expected);
            requireCurrentHandle(expected);requireExactCurrent(expected);
            if(expected.held!=null||originalHoldReadLoan!=null||expected.counter==Long.MAX_VALUE)throw invalid();
            var metadata=token.originalMetadataDataForFixedEpoch();
            long counter=metadata.counter;String values=metadata.valuesSha256,generation=metadata.generationId;
            String operation=metadata.operationId,plan=metadata.planSha256;
            String browserFrame=metadata.browserFrameSha256,browserPartSet=metadata.browserPartSetSha256;
            if(browserFrame==null||!browserFrame.matches("[a-f0-9]{64}")
                ||browserPartSet==null||!browserPartSet.matches("[a-f0-9]{64}"))throw invalid();
            if(counter!=expected.counter)throw invalid();
            try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                if(held==null)throw invalid();requireCurrentHandle(expected);requireExactCurrent(expected);
                Record old=read(current);
                try(var loan=new OriginalHoldReadLoan(expected,held)){
                    originalHoldReadLoan=loan;token.requireCurrent();loan.require(expected);
                } // PRE_INTENT ends before CREATE_NEW/writing, under same lock.
                byte[] bytes=null;Record candidate;
                try{
                    try(FileChannel output=FileChannel.open(pending,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
                        PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
                        var binding=new HeldOriginal(counter,key(pending).toString(),old.key.toString(),sha256(old.bytes),sha256(baselineBytes),values,generation,operation,plan,browserFrame,browserPartSet);
                        bytes=encodeHeld(binding);ByteBuffer buffer=ByteBuffer.wrap(bytes);long start=System.nanoTime();
                        while(buffer.hasRemaining()){if(System.nanoTime()-start>30_000_000_000L||output.write(buffer)<=0)throw invalid();}
                        io.forceFile(output);
                    }
                    forceDirectory();candidate=read(pending);
                    if(!Arrays.equals(bytes,candidate.bytes))throw invalid();requireHeldPredecessor(read(current),candidate);
                    var binding=candidate.held;
                    try(var loan=new OriginalHoldReadLoan(expected,candidate,held,binding)){
                        originalHoldReadLoan=loan;loan.require(expected);
                        // Re-run the ACTUAL full owning token after forced exact
                        // pending readback. Reentrant ordinary admission denies.
                        token.requireCurrent();loan.require(expected);
                        // Same forced pending/current protocol as v1; only this
                        // exact candidate can survive and be explicitly resumed.
                        try(var prepared=new Prepared(this,state())){
                            Current result=commitPreparedUnderLock(prepared,loan,token,channel,held);boolean returned=false;
                            try{
                                // Already hold the SAME file lock. Never open a
                                // second lock or consult the predecessor token
                                // after our own promotion invalidates it.
                                if(!Thread.holdsLock(COORDINATOR)||!held.isValid())throw invalid();
                                requireCurrentHandle(result);requireExactCurrent(result);
                                if(result.held==null||!result.fileKey.equals(candidate.key)
                                    ||!Arrays.equals(result.bytes,candidate.bytes))throw invalid();
                                returned=true;return result;
                            }
                            finally{if(!returned)result.close();}
                        }
                    }
                }finally{if(bytes!=null)Arrays.fill(bytes,(byte)0);}
            }
        }catch(Exception failure){if(expected!=null&&expected.store==this)expected.close();throw new VaultFailure(FAILURE,failure);}
        catch(Error failure){if(expected!=null&&expected.store==this)expected.close();throw failure;}}
    }
    Prepared prepareNext(Current expected)throws VaultFailure {
        synchronized(COORDINATOR){try{
            requireCurrentHandle(expected);try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                if(held==null)throw invalid();requireCurrentHandle(expected);requireExactCurrent(expected);
                if(expected.held!=null)throw invalid();
                if(expected.counter==Long.MAX_VALUE)throw invalid();
                byte[] next=encode(expected.counter+1);
                try{
                    pendingWriter.write(next);forceDirectory();requireCurrentHandle(expected);
                    Record old=read(current),candidate=read(pending);
                    if(!Arrays.equals(expected.bytes,old.bytes)||!expected.fileKey.equals(old.key)||!Arrays.equals(next,candidate.bytes))throw invalid();
                    State state=state();return new Prepared(this,state);
                }finally{Arrays.fill(next,(byte)0);}
            }
        }catch(Exception error){
            // A refused owning write preparation cannot revive its observed
            // Current. Keep all saved transition artifacts for exact recovery.
            if(expected!=null&&expected.store==this)expected.close();throw new VaultFailure(FAILURE,error);
        }catch(Error error){
            if(expected!=null&&expected.store==this)expected.close();throw error;
        }}
    }
    /** Explicit recovery observes only the already existing transition. The
     * actual force is repeated by commitPrepared, never credited by parsing. */
    Prepared readPreparedForResume()throws VaultFailure {
        synchronized(COORDINATOR){try{
            requireBase();try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                if(held==null)throw invalid();requireBase();return new Prepared(this,state());
            }
        }catch(Exception error){throw invalid();}}
    }
    /** Finish only the observed saved transition; commitPrepared re-forces
     * its exact bytes and aliases. No prepareNext or scalar counter fallback. */
    Current recoverCurrentMetadata()throws VaultFailure {
        synchronized(COORDINATOR){try{
            requireBase();
            if(exists(pending)||exists(previous)){
                try(var original=readPreparedForResume()){return commitPrepared(original);}
            }
            return readCurrent();
        }catch(Exception failure){throw invalid();}}
    }
    Current commitPrepared(Prepared expected)throws VaultFailure {
        synchronized(COORDINATOR){try{
            requirePreparedHandle(expected);try(FileChannel channel=openLock();FileLock held=channel.tryLock()){
                if(held==null)throw invalid();requirePreparedHandle(expected);
                return commitPreparedUnderLock(expected,null,null,channel,held);
            }
        }catch(Exception error){throw new VaultFailure(FAILURE,error);}}
    }
    private Current commitPreparedUnderLock(Prepared expected,OriginalHoldReadLoan loan,
        VaultEngine.NativeOriginalDurableWriterHold token,FileChannel channel,FileLock held)throws Exception {
                if(!Thread.holdsLock(COORDINATOR)||channel==null||held==null||!channel.isOpen()
                    ||!held.isValid()||held.channel()!=channel)throw invalid();
                State actual=state();requireSame(expected,actual);
                forceRecord(actual.pendingPresent?pending:current,actual.next);forceDirectory();
                requirePreparedHandle(expected);requireSame(expected,state());
                if(!actual.promoted){
                    if(!exists(previous)){
                        // The normal atomic publication combines the former
                        // link + current-unlink. Preserve the SAME live owning
                        // token/loan check before that removal of CURRENT.
                        if(loan!=null&&io==normalIo){token.requireCurrent();loan.require(loan.original);}
                        publishCounterRecord(expected,channel,held,true);forceDirectory();requirePreparedHandle(expected);requireSame(expected,state());
                    }
                    if(exists(current)){
                        if(!Files.isSameFile(current,previous))throw invalid();
                        forceRecord(previous,actual.old);forceDirectory();requireSame(expected,state());
                        if(loan!=null){token.requireCurrent();loan.require(loan.original);}
                        io.unlinkPredecessorCurrent();forceDirectory();requirePreparedHandle(expected);requireSame(expected,state());
                    }
                    publishCounterRecord(expected,channel,held,false);forceDirectory();requirePreparedHandle(expected);requireSame(expected,state());
                }
                // Before removing either link, force the exact promoted inode.
                actual=state();requireSame(expected,actual);if(!actual.promoted)throw invalid();
                forceRecord(current,actual.next);forceDirectory();requireSame(expected,state());
                if(exists(pending)){io.unlinkPending();forceDirectory();requirePreparedHandle(expected);requireSame(expected,state());}
                // The old counter remains until the promoted file is durable
                // and pending cleanup is complete. No unrelated file is deleted.
                io.unlinkPrevious();forceDirectory();requireBase();
                if(exists(pending)||exists(previous))throw invalid();Record result=read(current);
                if(!result.key.equals(expected.candidateKey)||!Arrays.equals(result.bytes,expected.candidate))throw invalid();
                return new Current(this,result);
    }
    /** Only the normal fixed native writer uses the shipping publication.
     * The existing private fault seam remains for original HOST fixtures;
     * no caller/configuration can select it and no failed publication falls
     * back to another protocol. The original record inodes are preserved. */
    private void publishCounterRecord(Prepared expected,FileChannel channel,FileLock held,boolean predecessor)throws Exception {
        publishCounterRecord(expected,channel,held,predecessor,null);
    }
    private void publishCounterRecord(Prepared expected,FileChannel channel,FileLock held,boolean predecessor,
        OrdinaryExternalWrite external)throws Exception {
        if(io!=normalIo){if(predecessor)io.linkPredecessor();else io.linkCandidate();return;}
        try(var publication=new FixedCounterPublication(this,expected,channel,held,predecessor,external)){
            NativePrivateMutationEpochPublisher.publish(publication);
        }
    }
    /** Metadata-only publication scope minted under the ACTUAL original
     * epoch FileLock from a fully checked private Prepared. Not a WORK,
     * original-inventory, ACK, enrollment or key capability. No wire, caller
     * root/name/counter/body or injected callback can construct this scope. */
    static final class FixedCounterPublication implements AutoCloseable {
        private final NativePrivateMutationEpochStore store;
        private final Prepared expected;
        private final FileChannel channel;
        private final FileLock held;
        private final OrdinaryExternalWrite external;
        private final Thread thread=Thread.currentThread();
        private final Path source,destination;
        private final Object originalKey;
        private byte[] originalBytes;
        private FileChannel reservation;
        private Object reservationKey;
        private boolean attempted,published,closed;
        private FixedCounterPublication(NativePrivateMutationEpochStore store,Prepared expected,
            FileChannel channel,FileLock held,boolean predecessor,OrdinaryExternalWrite external)throws Exception {
            this.store=store;this.expected=expected;this.channel=channel;this.held=held;this.external=external;
            source=predecessor?store.current:store.pending;
            destination=predecessor?store.previous:store.current;
            originalKey=predecessor?expected.predecessorKey:expected.candidateKey;
            originalBytes=(predecessor?expected.predecessor:expected.candidate).clone();
            requireContext();requireSame(expected,external==null?store.state():store.externalState(external));requireOriginal(source);
            if(exists(destination))throw invalid();
        }
        private void requireContext()throws Exception {
            if(closed||Thread.currentThread()!=thread||!Thread.holdsLock(COORDINATOR)
                ||originalBytes==null||!channel.isOpen()||!held.isValid()||held.channel()!=channel)throw invalid();
            if(external==null)store.requirePreparedHandle(expected);
            else{
                // ONLY the actual existing external-write owner may retain
                // its own durable UNKNOWN marker through this publication.
                // Normal readers still refuse that marker; no public bypass.
                if(store.ordinaryExternalWrite!=external||external.channel!=channel||external.held!=held
                    ||expected.store!=store||!expected.directoryKey.equals(store.directoryKey)
                    ||!expected.lockKey.equals(store.lockKey))throw invalid();
                expected.requireOpen();store.requireExternalBase(external);
            }
        }
        private void requireOriginal(Path path)throws Exception {
            Record record=store.read(path);
            try{if(!originalKey.equals(record.key)||!Arrays.equals(originalBytes,record.bytes))throw invalid();}
            finally{Arrays.fill(record.bytes,(byte)0);}
        }
        Path source()throws VaultFailure {
            try{requireContext();if(published)throw invalid();return source;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
        }
        Path destination()throws VaultFailure {
            try{requireContext();if(published)throw invalid();return destination;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
        }
        /** CREATE_NEW is performed by this fixed owner, not asserted by a
         * caller-supplied key/boolean. A raced/preexisting target refuses.
         * Only this empty private slot can be replaced by the atomic move.
         * Failure keeps the slot AND both original records for reconciliation;
         * unknown/partial metadata never grants work or automatic recovery. */
        FileChannel reserveDestination()throws VaultFailure {
            try{
                requireContext();if(attempted||published)throw invalid();attempted=true;
                requireOriginal(source);if(exists(destination))throw invalid();
                reservation=FileChannel.open(destination,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
                    PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
                var attributes=store.requireFile(destination);
                if(attributes.size()!=0||attributes.fileKey()==null)throw invalid();
                reservationKey=attributes.fileKey();requireReservedDestination(reservation);return reservation;
            }catch(Exception error){throw new VaultFailure(FAILURE,error);}
        }
        void requireReservedDestination(FileChannel actual)throws VaultFailure {
            try{
                requireContext();if(published||actual==null||actual!=reservation||!actual.isOpen()||reservationKey==null)throw invalid();
                requireOriginal(source);var attributes=store.requireFile(destination);
                if(attributes.size()!=0||!reservationKey.equals(attributes.fileKey()))throw invalid();
                requireContext();requireOriginal(source);attributes=store.requireFile(destination);
                if(attributes.size()!=0||!reservationKey.equals(attributes.fileKey()))throw invalid();
            }catch(Exception error){throw new VaultFailure(FAILURE,error);}
        }
        void requirePublishedOriginal()throws VaultFailure {
            try{
                requireContext();if(!attempted||published||reservation==null||!reservation.isOpen()||reservationKey==null)throw invalid();
                if(exists(source))throw invalid();requireOriginal(destination);requireContext();
                if(exists(source))throw invalid();requireOriginal(destination);published=true;
            }catch(Exception error){throw new VaultFailure(FAILURE,error);}
        }
        @Override public void close()throws VaultFailure {
            closed=true;
            try{if(reservation!=null)reservation.close();}
            catch(Exception error){throw new VaultFailure(FAILURE,error);}
            finally{if(originalBytes!=null)Arrays.fill(originalBytes,(byte)0);originalBytes=null;}
            // Never close the caller's original epoch channel/FileLock, or
            // unlink a reserved/unknown slot or either original record.
        }
    }
    private State state()throws Exception {
        requireBase();return stateRecords();
    }
    private State stateRecords()throws Exception {
        boolean hasCurrent=exists(current),hasPending=exists(pending),hasPrevious=exists(previous);
        if(!hasPending&&!hasPrevious)throw invalid();
        Record c=hasCurrent?read(current):null,p=hasPending?read(pending):null,old=hasPrevious?read(previous):null;
        Record next;boolean promoted;
        if(old==null){
            if(c==null||p==null)throw invalid();old=c;next=p;promoted=false;
        }else if(c==null){
            if(p==null)throw invalid();next=p;promoted=false;
        }else if(c.key.equals(old.key)){
            if(p==null||!Files.isSameFile(current,previous)||!Arrays.equals(c.bytes,old.bytes))throw invalid();next=p;promoted=false;
        }else{
            next=c;promoted=true;
            if(p!=null&&(!p.key.equals(c.key)||!Files.isSameFile(current,pending)||!Arrays.equals(p.bytes,c.bytes)))throw invalid();
        }
        if(old.held!=null||old.counter==Long.MAX_VALUE||next.counter!=old.counter+1||next.predecessor!=old.counter||next.key.equals(old.key))throw invalid();
        if(next.held!=null)requireHeldPredecessor(old,next);
        return new State(old,next,promoted,hasPending);
    }
    private void requireHeldPredecessor(Record old,Record next)throws Exception {
        if(old.held!=null||next.held==null||next.held.originalCounter!=old.counter
            ||next.counter!=old.counter+1||!next.held.predecessorInode.equals(old.key.toString())
            ||!next.held.predecessorSha256.equals(sha256(old.bytes))
            ||!next.held.baselineSha256.equals(sha256(baselineBytes)))throw invalid();
    }
    private void requireCurrentHandle(Current expected)throws Exception {
        if(expected==null||expected.store!=this)throw invalid();expected.requireOpen();requireBase();
        if(!expected.directoryKey.equals(key(directory))||!expected.lockKey.equals(key(lock)))throw invalid();
    }
    private void requireExactCurrent(Current expected)throws Exception {
        if(exists(pending)||exists(previous))throw invalid();Record actual=read(current);
        if(!actual.key.equals(expected.fileKey)||!Arrays.equals(actual.bytes,expected.bytes))throw invalid();
    }
    private void requirePreparedHandle(Prepared expected)throws Exception {
        if(expected==null||expected.store!=this)throw invalid();expected.requireOpen();requireBase();
        if(!expected.directoryKey.equals(key(directory))||!expected.lockKey.equals(key(lock)))throw invalid();
    }
    private static void requireSame(Prepared expected,State actual)throws Exception {
        if(!expected.predecessorKey.equals(actual.old.key)||!expected.candidateKey.equals(actual.next.key)
            ||!Arrays.equals(expected.predecessor,actual.old.bytes)||!Arrays.equals(expected.candidate,actual.next.bytes))throw invalid();
    }
    private void writePending(byte[] bytes)throws Exception {
        try(FileChannel output=FileChannel.open(pending,Set.of(StandardOpenOption.WRITE,StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS),
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")))){
            ByteBuffer buffer=ByteBuffer.wrap(bytes);long start=System.nanoTime();
            while(buffer.hasRemaining()){if(System.nanoTime()-start>30_000_000_000L||output.write(buffer)<=0)throw invalid();}
            io.forceFile(output);
        }
    }
    private static byte[] encode(long counter)throws Exception {
        byte[] bytes=new byte[RECORD_BYTES];ByteBuffer.wrap(bytes).putInt(MAGIC).putInt(1).putLong(counter==0?-1:counter-1).putLong(counter);
        byte[] hash=MessageDigest.getInstance("SHA-256").digest(Arrays.copyOf(bytes,24));System.arraycopy(hash,0,bytes,24,32);return bytes;
    }
    private static String sha256(byte[] bytes)throws Exception {
        byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder text=new StringBuilder(64);
        for(byte value:hash)text.append(Character.forDigit((value>>>4)&15,16)).append(Character.forDigit(value&15,16));return text.toString();
    }
    private static byte[] encodeHeld(HeldOriginal held)throws Exception {
        if((held.browserFrameSha256==null)!=(held.browserPartSetSha256==null))throw invalid();
        boolean browserBound=held.browserFrameSha256!=null;
        if(browserBound&&(!held.browserFrameSha256.matches("[a-f0-9]{64}")
            ||!held.browserPartSetSha256.matches("[a-f0-9]{64}")))throw invalid();
        var output=new ByteArrayOutputStream();try(var data=new DataOutputStream(output)){
            data.writeInt(MAGIC);data.writeInt(browserBound?3:2);data.writeLong(held.originalCounter);data.writeLong(held.originalCounter+1);
            for(String value:new String[]{held.inode,held.predecessorInode,held.predecessorSha256,held.baselineSha256,
                held.originalValuesSha256,held.originalGenerationId,held.originalOperationId,held.originalPlanSha256})data.writeUTF(value);
            if(browserBound){data.writeUTF(held.browserFrameSha256);data.writeUTF(held.browserPartSetSha256);}
        }
        output.write(MessageDigest.getInstance("SHA-256").digest(output.toByteArray()));
        byte[] bytes=output.toByteArray();if(bytes.length>MAX_HELD_RECORD_BYTES)throw invalid();return bytes;
    }
    private Record read(Path path)throws Exception {
        BasicFileAttributes before=requireFile(path);if(before.size()<RECORD_BYTES||before.size()>MAX_HELD_RECORD_BYTES)throw invalid();byte[] bytes=new byte[(int)before.size()];
        try(FileChannel input=FileChannel.open(path,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){
            if(input.size()!=bytes.length)throw invalid();ByteBuffer buffer=ByteBuffer.wrap(bytes);
            while(buffer.hasRemaining())if(input.read(buffer)<=0)throw invalid();
            if(input.read(ByteBuffer.allocate(1))!=-1)throw invalid();BasicFileAttributes after=requireFile(path);
            if(!before.fileKey().equals(after.fileKey())||!before.lastModifiedTime().equals(after.lastModifiedTime())||before.size()!=after.size())throw invalid();
            var record=new Record(bytes,before.fileKey());
            if(record.held!=null&&!record.held.baselineSha256.equals(sha256(baselineBytes)))throw invalid();return record;
        }
    }
    private void forceRecord(Path path,Record expected)throws Exception {
        Record before=read(path);if(!before.key.equals(expected.key)||!Arrays.equals(before.bytes,expected.bytes))throw invalid();
        try(FileChannel channel=FileChannel.open(path,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){io.forceFile(channel);}
        Record after=read(path);if(!after.key.equals(expected.key)||!Arrays.equals(after.bytes,expected.bytes))throw invalid();
    }
    private void requireBase()throws Exception {
        // Immutable constructor-validated DATA only. Every invocation still
        // reads the real baseline and its native identities on BOTH sides.
        String[] fields=originalBaselineFields();requireBaseIdentities(fields);
        // One closed synchronous read batch, with fresh complete native
        // identities at entry and exit. No attributes cross either boundary.
        requireBootstrapMarkerAbsent();
        byte[] observed=readFixed(directory.resolve(BASELINE),baselineBytes.length,owner,baselineKey,ownerUid);
        try{
            if(!Arrays.equals(baselineBytes,observed))throw invalid();
            try(var paths=Files.newDirectoryStream(directory)){
                int seen=0;
                for(Path path:paths){
                    String name=path.getFileName().toString();
                    if(++seen>ARTIFACTS.size()||BOOTSTRAP.equals(name)||!ARTIFACTS.contains(name))throw invalid();
                    requireFile(path);
                }
            }
            if(requireFile(lock).size()!=0)throw invalid();
            for(Path path:new Path[]{current,pending,previous})if(exists(path)&&Files.isSameFile(lock,path))throw invalid();
            requireBaseIdentities(fields);
        }finally{Arrays.fill(observed,(byte)0);}
    }
    private String[] originalBaselineFields()throws Exception {
        try(var input=new DataInputStream(new ByteArrayInputStream(baselineBytes,0,baselineBytes.length-32))){
            if(input.readInt()!=0x4d5a4231||input.readInt()!=1)throw invalid();
            String[] fields=new String[7];for(int i=0;i<fields.length;i++)fields[i]=input.readUTF();
            if(input.read()!=-1)throw invalid();return fields;
        }
    }
    /** No attributes or positive verdict escape this synchronous check. Keep
     * actual numeric UID and exact key/name encodings from validatedBaseline,
     * not a substitute principal/provider. The gated native path binds UID
     * equality only under the core platform's actual principal contract. */
    private void requireBaseIdentities(String[] fields)throws Exception {
        if(contextRoot!=null)contextRoot.requireRoot(root);
        var rootAttributes=requireBaseDirectory(root,rootKey,fields[1],contextRoot==null?0700:contextRoot.mode);
        // Compare the exact encoded numeric UID at this same fresh root
        // boundary. The unsupported-provider path still reads unix:uid.
        if(!fields[6].equals(Long.toString(rootAttributes==null?uid(root):rootAttributes.uid)))throw invalid();
        requireBaseDirectory(directory,directoryKey,fields[2]);
        var lockAttributes=requireFile(lock);var baselineAttributes=requireFile(directory.resolve(BASELINE));
        if(!lockKey.equals(lockAttributes.fileKey())||!fields[3].equals(lockAttributes.fileKey().toString())
            ||!baselineKey.equals(baselineAttributes.fileKey())||!fields[4].equals(baselineAttributes.fileKey().toString())
            ||baselineAttributes.size()!=baselineBytes.length||lockAttributes.size()!=0
            ||!fields[5].equals(owner.getName()))throw invalid();
        if(contextRoot!=null)contextRoot.requireRoot(root);
    }
    /** Entry-only part of requireBase's closed read batch, never a standalone
     * validity verdict. The complete batch checks identities before and after
     * its IO, and its terminal artifact scan checks marker absence again.
     * Opening, iteration or close failure is always refusal. */
    private void requireBootstrapMarkerAbsent()throws Exception {
        try(var paths=Files.newDirectoryStream(directory)){
            int seen=0;
            for(Path path:paths){
                if(++seen>ARTIFACTS.size()||BOOTSTRAP.equals(path.getFileName().toString()))throw invalid();
            }
        }
    }
    private NativeAttributes requireBaseDirectory(Path path,Object expectedKey,String encodedKey)throws Exception {
        return requireBaseDirectory(path,expectedKey,encodedKey,0700);
    }
    private NativeAttributes requireBaseDirectory(Path path,Object expectedKey,String encodedKey,int expectedMode)throws Exception {
        // Only the private ORIGINAL Context loan can authorize its unchanged
        // OS-managed parent profile. Never a File-only root or journal child.
        if(expectedMode!=0700&&(expectedMode!=0771||contextRoot==null
            ||!path.equals(root)||contextRoot.mode!=expectedMode))throw invalid();
        // Canonical-path IO precedes this boundary's ONE fresh attribute
        // snapshot. Do not reuse any attributes from before that IO.
        if(!path.toFile().getAbsoluteFile().equals(path.toFile().getCanonicalFile()))throw invalid();
        var nativeAttributes=nativeAttributes(path,owner,ownerUid);
        if(nativeAttributes!=null){
            if(!nativeAttributes.isDirectory()||nativeAttributes.isSymbolicLink()
                ||!expectedKey.equals(nativeAttributes.fileKey())||!encodedKey.equals(nativeAttributes.fileKey().toString())
                ||(nativeAttributes.mode&0777)!=expectedMode)throw invalid();return nativeAttributes;
        }
        var attributes=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!attributes.isDirectory()||attributes.isSymbolicLink()||attributes.fileKey()==null
            ||!expectedKey.equals(attributes.fileKey())||!encodedKey.equals(attributes.fileKey().toString())
            ||!owner.equals(attributes.owner())
            ||!attributes.permissions().equals(PosixFilePermissions.fromString(expectedMode==0771?"rwxrwx--x":"rwx------")))throw invalid();
        return null;
    }
    private BasicFileAttributes requireFile(Path path)throws Exception {
        return privateFile(path,owner,ownerUid);
    }
    private static void requireDirectory(Path path)throws Exception {
        var attributes=Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!attributes.isDirectory()||attributes.isSymbolicLink()||attributes.fileKey()==null
            ||!path.toFile().getAbsoluteFile().equals(path.toFile().getCanonicalFile())
            ||!Files.getPosixFilePermissions(path,LinkOption.NOFOLLOW_LINKS).equals(PosixFilePermissions.fromString("rwx------")))throw invalid();
    }
    private static void requireRootDirectory(Path path,ContextRoot original)throws Exception {
        if(original==null)requireDirectory(path);else original.requireRoot(path);
    }
    private FileChannel openLock()throws Exception {requireBase();return FileChannel.open(lock,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);}
    private void forceDirectory()throws Exception {requireBase();try(FileChannel channel=FileChannel.open(directory,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS)){io.forceDirectory(channel);}requireBase();}
    private static Object key(Path path)throws Exception {Object key=Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey();if(key==null)throw invalid();return key;}
    private static boolean exists(Path path)throws Exception {try{Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);return true;}catch(java.nio.file.NoSuchFileException absent){return false;}}
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
