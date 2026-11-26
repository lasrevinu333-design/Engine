package org.memphiszoo.custodial.vault;

import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.*;
import javax.crypto.spec.*;

/** Standalone synthetic-JCE storage qualification. No Android keystore,
 * browser, native finalizer, manager or reassignment authority is fabricated. */
public final class NativeRetainedEnrollmentRealmStoreTest {
    static int assertions;
    interface Checked {void run()throws Exception;}
    static void check(boolean ok)throws Exception {assertions++;if(!ok)throw new AssertionError("assertion "+assertions);}
    static void refuses(Checked c)throws Exception {boolean refused=false;try{c.run();}catch(VaultFailure e){refused=true;}check(refused);}
    static final class SyntheticExistingCipher implements CredentialCipher {
        final javax.crypto.SecretKey key;int existingEncryptions;int failEncryptAt;boolean missing;
        SyntheticExistingCipher()throws Exception {var k=KeyGenerator.getInstance("AES");k.init(256);key=k.generateKey();}
        public EncryptedSecret encrypt(char[] clear)throws VaultFailure {throw new AssertionError("creating key path forbidden");}
        public EncryptedSecret encryptWithExistingKey(char[] clear)throws VaultFailure {
            try{if(missing)throw new Exception("missing existing key");existingEncryptions++;if(existingEncryptions==failEncryptAt)throw new Exception("synthetic metadata encryption interruption");
                var c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key);
                c.updateAAD(NativeRetainedEnrollmentRealmStore.AAD.getBytes(StandardCharsets.UTF_8));
                return new EncryptedSecret(Base64.getEncoder().encodeToString(c.doFinal(new String(clear).getBytes(StandardCharsets.UTF_8))),Base64.getEncoder().encodeToString(c.getIV()),4*1024*1024);
            }catch(Exception e){throw new VaultFailure("synthetic_key_unavailable",e);}
        }
        public char[] decrypt(EncryptedSecret secret)throws VaultFailure {
            try{if(missing)throw new Exception("missing existing key");
                var c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,Base64.getDecoder().decode(secret.iv)));
                c.updateAAD(NativeRetainedEnrollmentRealmStore.AAD.getBytes(StandardCharsets.UTF_8));
                return new String(c.doFinal(Base64.getDecoder().decode(secret.ciphertext)),StandardCharsets.UTF_8).toCharArray();
            }catch(Exception e){throw new VaultFailure("synthetic_key_unavailable",e);}
        }
        public void destroyKey(){throw new AssertionError("key removal forbidden");}
    }
    static Path fixture(Path parent,String name)throws Exception {return Files.createDirectory(parent.resolve(name));}
    static String id(){return UUID.randomUUID().toString();}
    static void requireRetainedBytes(Path directory,byte[] expected)throws Exception{
        try(DirectoryStream<Path> files=Files.newDirectoryStream(directory,"retained-incomplete-*.evidence")){
            var entries=files.iterator();
            check(entries.hasNext());
            check(Arrays.equals(Files.readAllBytes(entries.next()),expected));
            check(!entries.hasNext());
        }
    }
    static void testStageRecovery(Path parent)throws Exception{
        for(String scenario:List.of("staged","torn-stage","torn-reservation","torn-prepared","foreign-prepared")){
            Path root=fixture(parent,scenario),dir=root.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY);
            var cipher=new SyntheticExistingCipher();cipher.failEncryptAt=2;
            var store=new NativeRetainedEnrollmentRealmStore(root,cipher);
            String next=id(),operation=id(),binding="exact original binding";
            refuses(()->store.advance(store.read(),next,operation,binding));
            cipher.failEncryptAt=0;
            Path reservation=dir.resolve("reservation.bin");
            byte[] valid=Files.readAllBytes(reservation),partial=Arrays.copyOf(valid,8);
            if(scenario.equals("staged")||scenario.equals("torn-stage")){
                Files.move(reservation,dir.resolve("reservation.bin.stage"));
                Files.delete(dir.resolve("realms").resolve(next)); // Only the empty synthetic root.
            }
            if(scenario.equals("torn-reservation")||scenario.equals("torn-stage")){
                Path interrupted=scenario.equals("torn-stage")?dir.resolve("reservation.bin.stage"):reservation;
                Files.write(interrupted,partial,StandardOpenOption.TRUNCATE_EXISTING);
                var reopened=new NativeRetainedEnrollmentRealmStore(root,cipher,false);
                refuses(reopened::read);
                try{reopened.finishPrepared();throw new AssertionError("unauthenticated reservation accepted");}
                catch(VaultFailure failure){check(failure.code.equals(NativeRetainedEnrollmentRealmStore.RESERVATION_HELD));}
                check(Arrays.equals(Files.readAllBytes(interrupted),partial));
                check(!Files.exists(dir.resolve("current.bin")));
                continue;
            }
            if(!scenario.equals("staged")){
                Files.write(dir.resolve("prepared.bin"),scenario.equals("torn-prepared")?partial:new byte[]{7,8,9});
            }
            var reopened=new NativeRetainedEnrollmentRealmStore(root,cipher,false);
            refuses(reopened::read);
            if(scenario.equals("foreign-prepared")){
                refuses(reopened::finishPrepared);
                check(Arrays.equals(Files.readAllBytes(dir.resolve("prepared.bin")),new byte[]{7,8,9}));
                check(Arrays.equals(Files.readAllBytes(reservation),valid));
                continue;
            }
            var result=reopened.finishPrepared();
            check(result.realm.equals(next)&&result.operationId.equals(operation)&&result.binding.equals(binding));
            check(!Files.exists(reservation)&&!Files.exists(dir.resolve("reservation.bin.stage")));
            check(reopened.finishPrepared().sha256.equals(result.sha256));
            if(scenario.equals("torn-prepared"))requireRetainedBytes(dir,partial);
        }
        Path root=fixture(parent,"torn-transition"),dir=root.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY);
        var cipher=new SyntheticExistingCipher();
        var store=new NativeRetainedEnrollmentRealmStore(root,cipher);
        var expected=store.advance(store.read(),id(),id(),"original transition");
        Path original=dir.resolve("transition-"+expected.realm+".bin");
        byte[] encrypted=Files.readAllBytes(original),partial=Arrays.copyOf(encrypted,8);
        Files.move(dir.resolve("current.bin"),dir.resolve("prepared.bin"));
        Files.write(original,partial,StandardOpenOption.TRUNCATE_EXISTING);
        var reopened=new NativeRetainedEnrollmentRealmStore(root,cipher,false);
        var actual=reopened.finishPrepared();
        check(expected.sha256.equals(actual.sha256)&&expected.operationId.equals(actual.operationId));
        check(Arrays.equals(Files.readAllBytes(original),encrypted));
        requireRetainedBytes(dir,partial);
        check(reopened.finishPrepared().sha256.equals(actual.sha256));
    }
    static void testConcurrentReaders(Path root,SyntheticExistingCipher cipher,String expected)throws Exception{
        var firstRead=new CountDownLatch(1);
        var allowRead=new CountDownLatch(1);
        CredentialCipher blockingCipher=new CredentialCipher(){
            public EncryptedSecret encrypt(char[] clear)throws VaultFailure{return cipher.encrypt(clear);}
            public char[] decrypt(EncryptedSecret encrypted)throws VaultFailure{
                firstRead.countDown();
                try{if(!allowRead.await(5,TimeUnit.SECONDS))throw new AssertionError("fixture lock did not release");}
                catch(InterruptedException error){Thread.currentThread().interrupt();throw new AssertionError(error);}
                return cipher.decrypt(encrypted);
            }
            public void destroyKey(){throw new AssertionError("key removal forbidden");}
        };
        var first=new NativeRetainedEnrollmentRealmStore(root,blockingCipher,false);
        var second=new NativeRetainedEnrollmentRealmStore(root,cipher,false);
        ExecutorService threads=Executors.newFixedThreadPool(2);
        try{
            Future<NativeRetainedEnrollmentRealmStore.State> one=threads.submit(first::read);
            check(firstRead.await(5,TimeUnit.SECONDS));
            var secondEntered=new CountDownLatch(1);
            Future<NativeRetainedEnrollmentRealmStore.State> two=threads.submit(()->{secondEntered.countDown();return second.read();});
            check(secondEntered.await(5,TimeUnit.SECONDS));
            try{two.get(100,TimeUnit.MILLISECONDS);throw new AssertionError("second reader ran while the first held the lock");}
            catch(TimeoutException serialized){check(true);}
            finally{allowRead.countDown();}
            check(one.get(5,TimeUnit.SECONDS).sha256.equals(expected));
            check(two.get(5,TimeUnit.SECONDS).sha256.equals(expected));
        }finally{allowRead.countDown();threads.shutdownNow();}
    }
    public static void main(String[] args)throws Exception {
        if(args.length!=1)throw new IllegalArgumentException("new owned absolute fixture parent required");
        Path parent=Path.of(args[0]);Files.createDirectory(parent);
        SyntheticExistingCipher key=new SyntheticExistingCipher();Path root=fixture(parent,"normal");
        // Preserve byte witnesses outside the pointer store, including opaque
        // original attribution. These are synthetic storage witnesses only.
        Map<Path,byte[]> originals=new LinkedHashMap<>();
        for(int i=0;i<8;i++){Path p=root.resolve("original-namespace-"+i);byte[] b=("encrypted-original-actor-A-epoch7-"+i).getBytes(StandardCharsets.UTF_8);Files.write(p,b);originals.put(p,b);}
        Path browser=root.resolve("original-browser-ciphertext");byte[] browserBytes="encrypted-original-browser-A".getBytes(StandardCharsets.UTF_8);Files.write(browser,browserBytes);originals.put(browser,browserBytes);
        var store=new NativeRetainedEnrollmentRealmStore(root,key);var base=store.read();check(base.realm.equals("legacy"));check(store.realmRoot(base).equals(root));
        String first=id(),firstOp=id(),binding="original-employee-A/epoch7/native8-and-browser-capsule-hashes";
        var a=store.advance(base,first,firstOp,binding);check(a.realm.equals(first));check(a.previousRealm.equals("legacy"));check(a.binding.equals(binding));check(a.operationId.equals(firstOp));
        check(store.realmRoot(a).equals(root.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY).resolve("realms").resolve(first)));
        var reopened=new NativeRetainedEnrollmentRealmStore(root,key);check(reopened.read().sha256.equals(a.sha256));check(reopened.read().binding.equals(binding));
        for(var e:originals.entrySet())check(Arrays.equals(e.getValue(),Files.readAllBytes(e.getKey())));
        refuses(()->store.advance(base,id(),id(),"stale original"));
        Path dir=root.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY);
        check(!new String(Files.readAllBytes(dir.resolve("current.bin")),StandardCharsets.ISO_8859_1).contains(binding));
        byte[] firstBytes=Files.readAllBytes(dir.resolve("transition-"+first+".bin"));
        String second=id();var b=store.advance(a,second,id(),"new-employee-B/epoch8");check(b.previousRealm.equals(first));check(Files.isDirectory(store.realmRoot(a)));
        check(reopened.read().realm.equals(second));check(Arrays.equals(firstBytes,Files.readAllBytes(dir.resolve("transition-"+first+".bin"))));
        // Prepared response-loss recovery reuses exact encrypted bytes without
        // another encryption, UUID, root, predecessor or key creation.
        byte[] secondBytes=Files.readAllBytes(dir.resolve("current.bin"));
        Files.move(dir.resolve("current.bin"),dir.resolve("prepared.bin"));Files.write(dir.resolve("current.bin"),Files.readAllBytes(dir.resolve("transition-"+first+".bin")));
        int count=key.existingEncryptions;refuses(store::read);var recovered=reopened.finishPrepared();check(recovered.realm.equals(second));check(key.existingEncryptions==count);check(Arrays.equals(secondBytes,Files.readAllBytes(dir.resolve("current.bin"))));check(reopened.finishPrepared().sha256.equals(recovered.sha256));
        // First-transition crash with its predecessor pointer still absent.
        Path cold=fixture(parent,"first-crash");var coldStore=new NativeRetainedEnrollmentRealmStore(cold,key);var c=coldStore.advance(coldStore.read(),id(),id(),"old-A-attribution");Path coldDir=cold.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY);
        Files.move(coldDir.resolve("current.bin"),coldDir.resolve("prepared.bin"));Files.delete(coldDir.resolve("transition-"+c.realm+".bin"));
        refuses(coldStore::read);count=key.existingEncryptions;check(coldStore.finishPrepared().realm.equals(c.realm));check(key.existingEncryptions==count);
        // A missing current file without a matching prepared original is not
        // proof of a fresh install or permission to reuse the original realm.
        Path lost=fixture(parent,"lost-current");var lostStore=new NativeRetainedEnrollmentRealmStore(lost,key);lostStore.advance(lostStore.read(),id(),id(),"actor-A");Files.delete(lost.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY).resolve("current.bin"));refuses(lostStore::read);
        key.missing=true;refuses(reopened::read);key.missing=false;
        var wrong=new NativeRetainedEnrollmentRealmStore(root,new SyntheticExistingCipher());refuses(wrong::read);
        Path collision=fixture(parent,"collision");var collisionStore=new NativeRetainedEnrollmentRealmStore(collision,key);String same=id();Files.createDirectory(collision.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY).resolve("realms").resolve(same));refuses(()->collisionStore.advance(collisionStore.read(),same,id(),"cannot adopt prior root"));
        // Reject links and replaced roots, never follow them into another task.
        Path linked=fixture(parent,"linked");var linkStore=new NativeRetainedEnrollmentRealmStore(linked,key);var l=linkStore.advance(linkStore.read(),id(),id(),"A");Path ld=linked.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY);Files.move(ld.resolve("current.bin"),ld.resolve("outside.bin"));Files.createSymbolicLink(ld.resolve("current.bin"),ld.resolve("outside.bin"));refuses(linkStore::read);
        // An authenticated own reservation survives an interrupted metadata
        // encryption. A generic pre-existing root still refuses above.
        Path reserved=fixture(parent,"reserved-crash");var interruptedKey=new SyntheticExistingCipher();
        var reservedStore=new NativeRetainedEnrollmentRealmStore(reserved,interruptedKey);var reservedBefore=reservedStore.read();
        String reservedRealm=id(),reservedOperation=id(),reservedBinding="unchanged-original-A";interruptedKey.failEncryptAt=2;
        refuses(()->reservedStore.advance(reservedBefore,reservedRealm,reservedOperation,reservedBinding));
        Path rd=reserved.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY);
        check(Files.isRegularFile(rd.resolve("reservation.bin")));refuses(reservedStore::read);
        // Reproduce the earlier crash boundary before the reserved directory
        // was created; this removes only an empty owned disposable fixture.
        Files.delete(rd.resolve("realms").resolve(reservedRealm));interruptedKey.failEncryptAt=0;
        var reservedRestart=new NativeRetainedEnrollmentRealmStore(reserved,interruptedKey);
        var completedReservation=reservedRestart.finishPrepared();
        check(completedReservation.realm.equals(reservedRealm));check(completedReservation.operationId.equals(reservedOperation));
        check(completedReservation.binding.equals(reservedBinding));check(!Files.exists(rd.resolve("reservation.bin")));
        check(reservedRestart.read().sha256.equals(completedReservation.sha256));
        Path bootstrap=fixture(parent,"empty-bootstrap");Files.createDirectory(bootstrap.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY));
        int beforeBootstrap=key.existingEncryptions;
        var bootstrapped=new NativeRetainedEnrollmentRealmStore(bootstrap,key,false);check(bootstrapped.read().realm.equals("legacy"));
        check(key.existingEncryptions==beforeBootstrap);
        Path missingLock=fixture(parent,"missing-committed-lock");var missingLockStore=new NativeRetainedEnrollmentRealmStore(missingLock,key);
        missingLockStore.advance(missingLockStore.read(),id(),id(),"must-not-reset");Files.delete(missingLock.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY).resolve("owner.lock"));
        refuses(()->new NativeRetainedEnrollmentRealmStore(missingLock,key));
        Path foreignBootstrap=fixture(parent,"foreign-bootstrap");Path foreignDir=Files.createDirectory(foreignBootstrap.resolve(NativeRetainedEnrollmentRealmStore.DIRECTORY));
        Files.write(foreignDir.resolve("unexpected.bin"),new byte[]{1});refuses(()->new NativeRetainedEnrollmentRealmStore(foreignBootstrap,key));
        check(Arrays.equals(new byte[]{1},Files.readAllBytes(foreignDir.resolve("unexpected.bin"))));
        for(var e:originals.entrySet())check(Arrays.equals(e.getValue(),Files.readAllBytes(e.getKey())));
        testStageRecovery(parent);
        testConcurrentReaders(root,key,b.sha256);
        System.out.println("PASS "+assertions+" storage assertions; SYNTHETIC_JCE_ONLY; Android/browser/owning-finalizer/reassignment NOT_QUALIFIED");
    }
}
