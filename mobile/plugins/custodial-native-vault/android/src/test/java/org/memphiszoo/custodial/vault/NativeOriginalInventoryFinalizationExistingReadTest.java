package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.lang.reflect.InvocationTargetException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicInteger;

/** New existing-root read integration only. Reuses an ALREADY retained
 * synthetic fixture's actual HELD files; never manufactures a private handle,
 * key, credential, manager, approval, original context or successful write.
 * All preference/crypto/network/effect ports deliberately deny on any call. */
public final class NativeOriginalInventoryFinalizationExistingReadTest {
    private static final AtomicInteger calls=new AtomicInteger();
    @SuppressWarnings("unchecked") private static <T>T deny(Class<T> type){
        return (T)Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},(proxy,method,args)->{
            calls.incrementAndGet();throw new AssertionError("Unexpected port: "+method.getName());
        });
    }
    private static Map<String,String> fingerprint(Path root)throws Exception {
        Map<String,String> result=new TreeMap<>();long total=0;int count=0;
        try(var paths=Files.walk(root,8)){
            for(Path path:paths.sorted().toList()){
                if(++count>4096||Files.isSymbolicLink(path))throw new AssertionError("Unbounded or aliased fixture");
                var info=Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                if(info.fileKey()==null||(!info.isRegularFile()&&!info.isDirectory()))throw new AssertionError("Unknown fixture object");
                String shape=info.fileKey()+":"+Files.getPosixFilePermissions(path,LinkOption.NOFOLLOW_LINKS);
                if(info.isRegularFile()){
                    total+=info.size();if(info.size()>80*1024*1024L||total>160*1024*1024L)throw new AssertionError("Fixture byte budget");
                    byte[] bytes=Files.readAllBytes(path);
                    try{shape+=":"+java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
                    finally{Arrays.fill(bytes,(byte)0);}
                }
                result.put(root.relativize(path).toString(),shape);
            }
        }
        return result;
    }
    public static void main(String[] args)throws Exception {
        if(args.length==1&&"--raw-browser-terminal-fence-only".equals(args[0])){
            rawBrowserTerminalFence();return;
        }
        if(args.length==2&&"--installed-held-namespace-prerequisite-only".equals(args[0])){
            installedHeldNamespacePrerequisite(Path.of(args[1]));return;
        }
        if(args.length!=2||!"--existing-original-no-intent-only".equals(args[0]))
            throw new IllegalArgumentException("Only the new fixed existing-root read member");
        Path root=Path.of(args[1]);
        if(!root.isAbsolute()||!root.equals(root.toRealPath())
            ||!Files.isRegularFile(root.resolve(NativePrivateMutationEpochStore.DIRECTORY).resolve("epoch.current"),LinkOption.NOFOLLOW_LINKS))
            throw new AssertionError("An actual saved original HELD fixture is required");
        var before=fingerprint(root);
        AndroidProtectedWorkPreferences.recoverExistingMutationEpochJournalFromNativeNoBackupRoot(root.toFile());
        VaultEngine engine=new VaultEngine(deny(VaultPersistence.class),deny(CredentialCipher.class),deny(EnrollmentTransport.class),
            deny(LegacyVaultSource.class),deny(InstallationSealGenerator.class),()->{
                calls.incrementAndGet();throw new AssertionError("No event clock proof in this read");
            },()->{calls.incrementAndGet();throw new AssertionError("No ordinary admission in this read");});
        Map<String,SharedPreferences> raw=new TreeMap<>();
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())raw.put(name,deny(SharedPreferences.class));
        var readers=AndroidProtectedNamespaceReaders.bind(raw);
        var journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(root.toFile());
        var capsules=NativePrivateCapsuleFileStore.fromNativeNoBackupRoot(root.toFile());
        try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead();var control=new NativePrivateCustodyFrameReadControl()){
            held.requireCurrent();
            var result=engine.inspectExistingOriginalFinalization(readers,journal,capsules,held,control);
            if(result.length()!=11||!"custodial.native-original-enrollment-finalization-readback.v1".equals(result.get("schema"))
                ||!"NO_LOCAL_FINALIZATION_INTENT_OBSERVED_NO_WRITE_PERMISSION".equals(result.get("state")))throw new AssertionError("Unknown absence projection");
            for(String field:new String[]{"original_rows_compared","original_credential_readable","original_capsule_ciphertext_compared",
                "inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal","phone_released"})
                if(!Boolean.FALSE.equals(result.get(field)))throw new AssertionError("Absence gained permission: "+field);
            held.requireCurrent();
        }
        if(calls.get()!=0||!before.equals(fingerprint(root)))throw new AssertionError("Existing-only read touched a port or original");
        System.out.println("PASS_NEW_EXISTING_HELD_ROOT no intent remains no write permission; zero preference cipher clock network or effect calls; original files unchanged");
        Path foreign=Files.createTempDirectory("custodial-finalization-foreign-root-");
        try{
            var foreignJournal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(foreign.toFile());
            try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead();var control=new NativePrivateCustodyFrameReadControl()){
                try{engine.inspectExistingOriginalFinalization(readers,foreignJournal,capsules,held,control);
                    throw new AssertionError("A foreign native root reused the installed original HELD owner");}
                catch(VaultFailure expected){/* No retry/adoption or repair. */}
            }
            try(var children=Files.list(foreign)){if(children.findAny().isPresent())throw new AssertionError("Refusal created foreign files");}
            // Pure fixed-path guard only: no private read-control/authority is
            // constructed. ENOTDIR is a real provider failure which the old
            // Files.exists API would silently report as false absence.
            Path parent=Files.createFile(foreign.resolve("not-a-directory"));
            try{
                var check=VaultEngine.NativePrivateCustodyExchangeJournal.class.getDeclaredMethod("finalizationPathPresent",Path.class);
                check.setAccessible(true);Path unavailable=parent.resolve("intent.bin");
                if(Files.exists(unavailable,LinkOption.NOFOLLOW_LINKS))throw new AssertionError("Expected provider counterexample");
                try{check.invoke(null,unavailable);throw new AssertionError("Provider failure was classified as absent");}
                catch(InvocationTargetException expected){if(!(expected.getCause() instanceof java.io.IOException)
                    ||expected.getCause() instanceof java.nio.file.NoSuchFileException)throw expected;}
            }finally{Files.delete(parent);}
        }finally{Files.delete(foreign);}
        if(calls.get()!=0||!before.equals(fingerprint(root)))throw new AssertionError("Foreign-root refusal changed original state");
        System.out.println("PASS_NEW_EXISTING_HELD_ROOT foreign root refuses before creation or private ports; original files unchanged");
        System.out.println("PASS_NEW_FIXED_PATH_GUARD real ENOTDIR remains unavailable, not false absence");
        System.out.println("SAVED_SYNTHETIC_HELD_FILES_ONLY; NO_EXISTING_GCM_INTENT_POSITIVE_OR_RESTART_EFFECT_OR_GENUINE_MANAGER_ANDROID_PROOF");
    }

    /** Synthetic raw ciphertext DATA only. Reflection invokes a fixed
     * integrity comparator, never constructs/restores an ACK, HELD owner,
     * finalization control or authenticated GCM record. This isolates the
     * terminal post-callback file comparison used by the actual cold reader. */
    private static void rawBrowserTerminalFence()throws Exception {
        String parent=System.getProperty("custodial.custody.fixture.root");
        if(parent==null)throw new AssertionError("owned synthetic fixture root required");
        Path root=Files.createTempDirectory(Path.of(parent),"finalization-browser-raw-",
            java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rwx------")));
        Path dir=Files.createDirectory(root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY),
            java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rwx------")));
        Path lock=Files.createFile(dir.resolve("exchange.lock"),
            java.nio.file.attribute.PosixFilePermissions.asFileAttribute(java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")));
        String[] keys={"inventory_finalization_intent-0","browser_frame-0","browser_chunk-0"};
        var expected=new org.json.JSONArray();String intentDisk=null,intentPin=null;
        for(int i=0;i<keys.length;i++){
            byte[] bytes=new byte[96+i];Arrays.fill(bytes,(byte)(17+i));Path file=dir.resolve(keys[i]+".bin");
            Files.write(file,bytes);Files.setPosixFilePermissions(file,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            String digest=NativeRetainedAttempt.hash(bytes),pin=rawBrowserPin(root,dir,lock,file);
            if(i==0){intentDisk=digest;intentPin=pin;}else expected.put(new org.json.JSONArray().put(digest).put(pin));
            Arrays.fill(bytes,(byte)0);
        }
        var journal=VaultEngine.NativePrivateCustodyExchangeJournal.fromNativeNoBackupRoot(root.toFile());
        var method=VaultEngine.NativePrivateCustodyExchangeJournal.class.getDeclaredMethod("requireFinalizationRawPartSet",
            String.class,String.class,org.json.JSONArray.class,int.class,NativePrivateCustodyFrameReadControl.class,
            java.nio.channels.FileChannel.class,java.nio.channels.FileLock.class);
        method.setAccessible(true);
        try(var control=new NativePrivateCustodyFrameReadControl();
            var channel=java.nio.channels.FileChannel.open(lock,java.nio.file.StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);
            var held=channel.tryLock()){
            if(held==null)throw new AssertionError("actual fixed journal lock required");
            Object[] input={intentDisk,intentPin,expected,1,control,channel,held};
            method.invoke(journal,input);int refused=0;
            for(String key:keys){
                Path file=dir.resolve(key+".bin");byte[] original=Files.readAllBytes(file),changed=original.clone();
                var before=Files.readAttributes(file,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                changed[changed.length/2]^=1;
                // Same length/inode/mtime: identity-only checks miss this
                // mutation after a prior authenticated/owner callback.
                Files.write(file,changed);Files.setLastModifiedTime(file,before.lastModifiedTime());
                rawBrowserFenceRefuses(method,journal,input);refused++;
                Files.write(file,original);Files.setLastModifiedTime(file,before.lastModifiedTime());
                method.invoke(journal,input);
                Path saved=root.resolve("synthetic-preserved-"+key);Files.move(file,saved);
                rawBrowserFenceRefuses(method,journal,input);refused++;
                Files.copy(saved,file);Files.setPosixFilePermissions(file,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
                Files.setLastModifiedTime(file,before.lastModifiedTime());
                rawBrowserFenceRefuses(method,journal,input);refused++;
                Files.delete(file);Files.move(saved,file);method.invoke(journal,input);
                Path pending=dir.resolve(key+".pending");Files.createLink(pending,file);
                rawBrowserFenceRefuses(method,journal,input);refused++;
                Files.delete(pending);method.invoke(journal,input);
                Arrays.fill(original,(byte)0);Arrays.fill(changed,(byte)0);
            }
            Path extra=dir.resolve("browser_chunk-1.bin");Files.write(extra,new byte[96]);
            Files.setPosixFilePermissions(extra,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            rawBrowserFenceRefuses(method,journal,input);refused++;Files.delete(extra);method.invoke(journal,input);
            if(refused!=13)throw new AssertionError("Missing causal raw terminal cases");
            System.out.println("PASS_NEW_FINALIZATION_BROWSER_RAW_TERMINAL complete part-set; 13 same-time corruption/missing/inode/pending/extra refusals; exact originals restored");
            System.out.println("RAW_CIPHERTEXT_DATA_ONLY; GCM_HELD_MANAGER_ACK_SUCCESSOR_COLD_RESTART_NOT_RUN");
        }
    }
    private static String rawBrowserPin(Path root,Path dir,Path lock,Path file)throws Exception {
        var value=Files.readAttributes(file,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        return NativeProviderPrincipal.hash(new org.json.JSONArray()
            .put(Files.readAttributes(root,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey().toString())
            .put(Files.readAttributes(dir,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey().toString())
            .put(Files.readAttributes(lock,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey().toString())
            .put(value.fileKey().toString()).put(value.size()).put(value.lastModifiedTime().toString()).toString());
    }
    private static void rawBrowserFenceRefuses(java.lang.reflect.Method method,Object journal,Object[] input)throws Exception {
        try{method.invoke(journal,input);throw new AssertionError("Changed retained raw part-set was accepted");}
        catch(InvocationTargetException failure){if(!(failure.getCause() instanceof VaultFailure)&&!(failure.getCause() instanceof java.io.IOException))throw failure;}
    }

    /** Actual existing installed HELD metadata + real fixed reader family,
     * but intentionally WRONG raw source DATA. This is not a fabricated
     * private eligibility/ACK or a positive separation fixture. */
    private static void installedHeldNamespacePrerequisite(Path root)throws Exception {
        if(!root.isAbsolute()||!root.equals(root.toRealPath()))throw new AssertionError("exact existing fixture required");
        var before=fingerprint(root);
        AndroidProtectedWorkPreferences.recoverExistingMutationEpochJournalFromNativeNoBackupRoot(root.toFile());
        AtomicInteger reads=new AtomicInteger(),effects=new AtomicInteger();
        Map<String,SharedPreferences> raw=new TreeMap<>();
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())raw.put(name,
            (SharedPreferences)Proxy.newProxyInstance(NativeOriginalInventoryFinalizationExistingReadTest.class.getClassLoader(),
                new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                    if("getAll".equals(method.getName())){reads.incrementAndGet();return Map.of();}
                    effects.incrementAndGet();throw new AssertionError("Read prerequisite reached writer: "+method.getName());
                }));
        var readers=AndroidProtectedNamespaceReaders.bind(raw);
        int checked=0;
        try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead();
            var other=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()){
            held.requireCurrent();other.requireCurrent();
            try(var observed=NativeProtectedNamespaceObservation.observeHeldOriginal(readers,held)){
                if(!observed.stillCurrent())throw new AssertionError("stable wrong raw DATA prerequisite absent");
                try{observed.requireInstalledOriginalHeldOwner(held);throw new AssertionError("Later wrong raw baseline adopted as original");}
                catch(VaultFailure expected){if(!NativeProtectedNamespaceObservation.FAILURE.equals(expected.code))throw expected;}
                int stopped=reads.get();
                try{observed.requireInstalledOriginalHeldOwner(held);throw new AssertionError("Refused namespace revived");}
                catch(VaultFailure expected){if(!NativeProtectedNamespaceObservation.FAILURE.equals(expected.code))throw expected;}
                if(reads.get()!=stopped)throw new AssertionError("Retired observer reread/adopted raw DATA");
                checked++;
            }
            for(var expected:new AndroidProtectedWorkPreferences.HeldOriginalRead[]{null,other}){
                try(var observed=NativeProtectedNamespaceObservation.observeHeldOriginal(readers,held)){
                    int stopped=reads.get();
                    try{observed.requireInstalledOriginalHeldOwner(expected);throw new AssertionError("Missing/other owner lease adopted");}
                    catch(VaultFailure failure){if(!NativeProtectedNamespaceObservation.FAILURE.equals(failure.code))throw failure;}
                    if(reads.get()!=stopped)throw new AssertionError("Missing/foreign owner reached raw namespace");
                    checked++;
                }
            }
            held.requireCurrent();other.requireCurrent();
        }
        if(checked!=3||effects.get()!=0||!before.equals(fingerprint(root)))throw new AssertionError("Prerequisite changed original files/rows or missed a case");
        System.out.println("PASS_NEW_INSTALLED_HELD_NAMESPACE original descriptor rejects wrong stable raw baseline; missing/other lease refuses before namespace; retirement sticky; original files unchanged; writer calls0");
        System.out.println("THREE_NEW_NEGATIVE_PREREQUISITES_ONLY; POSITIVE_ELIGIBILITY_ACK_FINALIZATION_RESTART_AND_ANDROID_NOT_RUN");
    }
}
