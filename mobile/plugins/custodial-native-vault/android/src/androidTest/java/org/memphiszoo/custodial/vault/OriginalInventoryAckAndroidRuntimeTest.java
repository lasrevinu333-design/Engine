package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.Context;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFileAttributes;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import androidx.test.ext.junit.runners.AndroidJUnit4;

/** Actual fixed Android owners, installed durable native HELD and injected
 * browser Source. Enrollment/native/manager wire DATA remain the existing
 * synthetic recording fixture; this does not qualify genuine server SQL or
 * human-manager approval. No capability constructor or field is reflected. */
@RunWith(AndroidJUnit4.class)
public final class OriginalInventoryAckAndroidRuntimeTest {
    interface InventoryConsumer {
        /** Phase 1 may publish the original manifest; phase 2 reconstructs a
         * fresh owning invocation for the same retained request before final
         * current decision/ACK. Return only the exact expected sole snapshot
         * successor, or null when every original native row stays unchanged. */
        VaultSnapshot consume(Context application,VaultEngine engine,
            VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,
            VaultEngine.NativeOriginalInventoryAckRequestControl original,
            NativeOriginalInventoryAckRequestJournal.Result retained,
            NativePrivateCustodyHttp recoveryHttp,NativePrivateCustodyFrameReadControl control,
            NativeOriginalBrowserPreparation liveSource,int phase)throws Exception;
    }

    @Test(timeout=3_000_000)
    public void actualInstalledHeldOriginalReconstructsSameInventoryRequestWithoutResend()throws Exception {
        final String[] first={null};final int[] calls={0};
        final VaultEngine.NativeOriginalInventoryAckRequestControl[] predecessor={null};
        withActualHeldOriginalInventoryRequest((application,engine,prepared,original,retained,http,control,source,phase)->{
            synchronized(engine){
                var data=retained.originalForOwningDispatch(original);
                if(first[0]==null){first[0]=data.document;predecessor[0]=original;}
                else assertEquals("The next explicit invocation must reuse exact original signed bytes",first[0],data.document);
                JSONObject projection=retained.projection();
                assertEquals("LOCAL_SIGNED_REQUEST_RETAINED_NOT_ACK",projection.getString("state"));
                for(String flag:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
                    assertEquals(Boolean.FALSE,projection.get(flag));
                original.requireCurrent();control.check();calls[0]++;
                if(phase==2){
                    Path record=NativePrivateMutationEpochStore.originalContextNoBackupRoot(application).toPath()
                        .resolve(NativeOriginalInventoryAckRequestJournal.DIRECTORY).resolve("request.bin");
                    byte[] before=Files.readAllBytes(record);
                    var identity=Files.readAttributes(record,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey();
                    try{
                        assertThrows("Restored request DATA cannot claim first dispatch",VaultFailure.class,
                            ()->retained.claimFirstDispatchReservation(original));
                        assertNotSame(predecessor[0],original);
                        assertThrows("Prior invocation owner cannot borrow this current original",VaultFailure.class,
                            ()->retained.originalForOwningDispatch(predecessor[0]));
                        assertThrows("Wrong-owner refusal cannot revive current request authority",VaultFailure.class,original::requireCurrent);
                        assertArrayEquals(before,Files.readAllBytes(record));
                        assertEquals(identity,Files.readAttributes(record,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey());
                        assertTrue("No unknown/send was created",Files.notExists(record.getParent().getParent()
                            .resolve(NativeOriginalInventoryAckUnknownJournal.DIRECTORY),LinkOption.NOFOLLOW_LINKS));
                    }finally{Arrays.fill(before,(byte)0);}
                }
            }
            return null;
        });
        assertEquals(2,calls[0]);assertNotNull(first[0]);
    }

    static void withActualHeldOriginalInventoryRequest(InventoryConsumer consumer)throws Exception {
        withActualHeldOriginalInventoryRequest(consumer,null);
    }
    static void withActualHeldOriginalInventoryRequest(InventoryConsumer consumer,
        java.util.function.UnaryOperator<Context> beforeCaptureContext)throws Exception {
        if(consumer==null)throw new IllegalArgumentException("owning inventory consumer required");
        var producer=new Producer(consumer);
        try{ProtectedRecoveryEntryAndroidRuntimeTest.withActualOriginalInventoryAndroidProducer(producer,beforeCaptureContext);}
        finally{producer.closeWitnesses();}
    }

    private static final class Producer implements ProtectedRecoveryEntryAndroidRuntimeTest.OriginalInventoryAndroidProducer {
        private final InventoryConsumer consumer;
        private VaultSnapshot expectedSuccessor;
        private byte[] originalEpoch;
        private String heldStamp;
        private AndroidProtectedWorkPreferences.HeldOriginalRead.OriginalMetadata heldMetadata;
        private boolean inventoryProduced;
        private final Map<Path,Set<String>> inventoryChildren=new HashMap<>();
        private final Map<Path,Object> inventoryDirectoryKeys=new HashMap<>();
        Producer(InventoryConsumer consumer){this.consumer=consumer;}

        @Override public void afterPreservation(ProtectedRecoveryEntryAndroidRuntimeTest.InitialNativeFixture f,int action,
            VaultEngine.NativeSameOriginalRecoveryPreparedRequest prepared,NativePrivateCustodyHttp http,
            NativePrivateCustodyFrameReadControl control,NativeOriginalBrowserPreparation source,
            Map<Path,byte[]> files,Map<Path,PosixFileAttributes> identities,Map<Path,Set<String>> children)throws Exception {
            final long started=System.nanoTime();
            stage(action,"BEGIN",started);
            if(action==0){
                Path current=f.root.toPath().resolve(NativePrivateMutationEpochStore.DIRECTORY).resolve(NativePrivateMutationEpochStore.CURRENT);
                assertTrue("Initial owning witness must include exact predecessor epoch",files.containsKey(current));
                originalEpoch=files.get(current).clone();var before=identities.get(current);
                // The caller's detached witness scan follows this live action.
                // Pin the newly preserved browser ciphertext BEFORE the hold
                // independently, so moving that scan cannot rebaseline changes.
                var browserFiles=new HashMap<Path,byte[]>();var browserIdentities=new HashMap<Path,PosixFileAttributes>();
                Path browserDirectory=f.root.toPath().resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);
                try{
                for(String name:names(browserDirectory))if(name.matches("browser_(?:frame-0|chunk-[0-9]+)\\.bin"))
                    ProtectedRecoveryEntryAndroidRuntimeTest.firstCustodyLostSnapshot(browserDirectory.resolve(name),3_200_000,browserFiles,browserIdentities);
                assertTrue(browserFiles.containsKey(browserDirectory.resolve("browser_frame-0.bin")));
                assertTrue(browserFiles.containsKey(browserDirectory.resolve("browser_chunk-0.bin")));
                synchronized(f.engine){
                    stage(action,"BEFORE_HOLD_OWNER",started);
                    try(var hold=f.engine.prepareOriginalDurableWriterHold(prepared,control)){
                        stage(action,"HOLD_OWNER_CURRENT",started);
                        var original=hold.originalMetadataDataForFixedEpoch();
                        stage(action,"HOLD_METADATA_OBSERVED",started);
                        AndroidProtectedWorkPreferences.holdOriginalWriters(hold);
                        stage(action,"DURABLE_NATIVE_HOLD_INSTALLED",started);
                        // Deliberate denial transition invalidates predecessor;
                        // never validate/rebaseline that consumed prepared owner.
                        try(var installed=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()){
                            installed.requireCurrent();heldMetadata=installed.originalMetadataForOwningRecovery();
                            heldStamp=installed.heldStampForOwningObservation();
                            assertEquals("DURABLE_HELD:"+(original.counter+1),heldStamp);
                            assertEquals("DURABLE_ATTEMPT:"+original.counter,installed.originalStampForOwningReconstruction());
                            assertEquals(original.valuesSha256,heldMetadata.valuesSha256);
                            assertEquals(original.operationId,heldMetadata.operationId);
                            assertEquals(original.planSha256,heldMetadata.planSha256);
                            assertEquals(original.generationId,heldMetadata.generationId);
                            assertEquals(original.browserFrameSha256,heldMetadata.browserFrameSha256);
                            assertEquals(original.browserPartSetSha256,heldMetadata.browserPartSetSha256);
                        }
                    }
                }
                ProtectedRecoveryEntryAndroidRuntimeTest.firstCustodyLostSameFiles(browserFiles,browserIdentities);
                }finally{for(byte[] bytes:browserFiles.values())Arrays.fill(bytes,(byte)0);}
                // The ONLY intentional original-file successor is epoch.current.
                // Preserve predecessor bytes separately; every other expected
                // witness remains untouched. This is test DATA, never authority.
                var after=Files.readAttributes(current,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                assertNotEquals(before.fileKey(),after.fileKey());
                byte[] held=Files.readAllBytes(current);assertFalse(Arrays.equals(originalEpoch,held));
                files.put(current,held);identities.put(current,after);
                requireSameHeld();stage(action,"DURABLE_NATIVE_HOLD_WITNESSED",started);return;
            }
            assertTrue(action==1||action==2);requireSameHeld();
            // These are the normal fixed journals' owning APIs, not their
            // detached observation DTOs. A later action restores exact records.
            VaultEngine.NativeOriginalInventoryAckIntentControl issuer=null;
            NativeOriginalInventoryAckIntentJournal.Result intent=null;
            VaultEngine.NativeOriginalInventoryAckRequestControl original=null;
            NativeOriginalInventoryAckRequestJournal.Result retained=null;
            try{
                synchronized(f.engine){
                    stage(action,"BEFORE_INTENT_OWNER",started);
                    issuer=f.engine.prepareOriginalInventoryAckIntentControl(prepared,control);
                    stage(action,"INTENT_OWNER_CURRENT",started);
                    var intents=NativeOriginalInventoryAckIntentJournal.fromNativeNoBackupRoot(
                        NativePrivateMutationEpochStore.originalContextNoBackupRoot(f.application));
                    intent=action==1?intents.retainOriginalIntent(issuer):intents.inspectOriginalIntent(issuer);
                    assertNotNull(intent);stage(action,"INTENT_RETAINED_OR_INSPECTED",started);
                    original=f.engine.prepareOriginalInventoryAckRequestControl(issuer,intent);
                    stage(action,"REQUEST_OWNER_CURRENT",started);
                    var requests=NativeOriginalInventoryAckRequestJournal.fromNativeNoBackupRoot(
                        NativePrivateMutationEpochStore.originalContextNoBackupRoot(f.application));
                    retained=action==1?requests.retainOriginalRequest(original):requests.inspectOriginalRequest(original);
                    assertNotNull(retained);stage(action,"REQUEST_RETAINED_OR_INSPECTED",started);
                    original.requireCurrent();retained.requireCurrent();control.check();
                    stage(action,"BEFORE_OWNING_CONSUMER",started);
                }
                VaultSnapshot successor=consumer.consume(f.application,f.engine,prepared,original,retained,http,control,source,action);
                stage(action,"OWNING_CONSUMER_RETURNED",started);
                if(successor!=null){assertEquals(2,action);expectedSuccessor=successor;}
                // A successful finalizer intentionally consumed predecessor
                // owners. Only denial metadata and exact expected raw DATA are
                // inspected after the consumer; no old lease is revived.
                requireSameHeld();
                assertRaw(f);recordNewInventoryWitnesses(f,files,identities,children);inventoryProduced=true;
                stage(action,"EXACT_RAW_AND_FILE_WITNESSES_PRESERVED",started);
            }finally{
                synchronized(f.engine){try(var p=issuer;var i=intent;var o=original;var r=retained){}}
            }
        }

        private static void stage(int action,String stage,long started){
            System.out.println("UNIT_ORIGINAL_INVENTORY_STAGE action="+action+" stage="+stage
                +" elapsedMs="+java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started));
        }
        private void requireSameHeld()throws Exception {
            try(var held=AndroidProtectedWorkPreferences.openInstalledOriginalHeldRead()){
                held.requireCurrent();assertEquals(heldStamp,held.heldStampForOwningObservation());
                var now=held.originalMetadataForOwningRecovery();
                assertEquals(heldMetadata.originalCounter,now.originalCounter);
                assertEquals(heldMetadata.operationId,now.operationId);assertEquals(heldMetadata.planSha256,now.planSha256);
                assertEquals(heldMetadata.valuesSha256,now.valuesSha256);assertEquals(heldMetadata.generationId,now.generationId);
                assertEquals(heldMetadata.browserFrameSha256,now.browserFrameSha256);
                assertEquals(heldMetadata.browserPartSetSha256,now.browserPartSetSha256);
            }
        }
        @Override public Map<String,Map<String,?>> expectedRaw(ProtectedRecoveryEntryAndroidRuntimeTest.InitialNativeFixture f)throws Exception {
            if(expectedSuccessor==null)return f.originalPayload;
            var expected=new TreeMap<String,Map<String,?>>(f.originalPayload);
            var vault=new TreeMap<String,Object>();vault.putAll(f.originalPayload.get("MemphisZooCustodialNativeVaultV2"));
            byte[] bytes=new VaultSnapshotCodec().encode(expectedSuccessor);
            try{vault.put("authoritative_snapshot",Base64.getEncoder().encodeToString(bytes));}
            finally{Arrays.fill(bytes,(byte)0);}
            expected.put("MemphisZooCustodialNativeVaultV2",vault);return expected;
        }
        private void assertRaw(ProtectedRecoveryEntryAndroidRuntimeTest.InitialNativeFixture f)throws Exception {
            var expected=expectedRaw(f);
            for(var row:f.owners.entrySet())assertTrue("Only exact declared snapshot successor may differ: "+row.getKey(),
                NativeProtectedWorkSnapshot.exactRawEquals(expected.get(row.getKey()),row.getValue().getAll()));
        }
        private static Set<String> names(Path directory)throws Exception {
            var names=new TreeSet<String>();try(var entries=Files.newDirectoryStream(directory)){
                for(Path p:entries){assertTrue(p.getParent().equals(directory));names.add(p.getFileName().toString());}
            }return names;
        }
        private void recordNewInventoryWitnesses(ProtectedRecoveryEntryAndroidRuntimeTest.InitialNativeFixture f,
            Map<Path,byte[]> files,Map<Path,PosixFileAttributes> identities,Map<Path,Set<String>> children)throws Exception {
            Path exchange=f.root.toPath().resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY);
            for(Path directory:new Path[]{exchange,f.root.toPath().resolve(NativeOriginalInventoryAckIntentJournal.DIRECTORY),
                f.root.toPath().resolve(NativeOriginalInventoryAckRequestJournal.DIRECTORY),
                f.root.toPath().resolve(NativeOriginalInventoryAckUnknownJournal.DIRECTORY)}){
                if(Files.notExists(directory,LinkOption.NOFOLLOW_LINKS))continue;
                var d=Files.readAttributes(directory,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                assertTrue(d.isDirectory());assertFalse(d.isSymbolicLink());
                Set<String> observed=names(directory);
                for(String name:observed){Path path=directory.resolve(name);
                    if(files.containsKey(path))continue;
                    assertTrue("Only fixed normally-produced inventory files",directory.equals(exchange)?
                        name.matches("inventory_(?:frame|chunk|unknown|observation|decision|finalization_intent)-[0-9]+\\.bin"):
                        name.matches("(?:intent|request|unknown)\\.(?:lock|bin|pending)"));
                    var a=Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                    assertTrue(a.isRegularFile());assertFalse(a.isSymbolicLink());assertTrue(a.size()<=3_200_000);
                    byte[] bytes=Files.readAllBytes(path);assertEquals(a.size(),bytes.length);files.put(path,bytes);identities.put(path,a);
                }
                children.put(directory,observed);
                if(!directory.equals(exchange)){inventoryChildren.put(directory,observed);inventoryDirectoryKeys.put(directory,d.fileKey());}
            }
        }
        @Override public void requireInventoryDirectories(ProtectedRecoveryEntryAndroidRuntimeTest.InitialNativeFixture f)throws Exception {
            for(String name:new String[]{NativeOriginalInventoryAckIntentJournal.DIRECTORY,
                NativeOriginalInventoryAckRequestJournal.DIRECTORY,NativeOriginalInventoryAckUnknownJournal.DIRECTORY}){
                Path path=f.root.toPath().resolve(name);
                if(!inventoryProduced||!inventoryChildren.containsKey(path))assertTrue(Files.notExists(path,LinkOption.NOFOLLOW_LINKS));
                else{assertEquals(inventoryChildren.get(path),names(path));assertEquals(inventoryDirectoryKeys.get(path),
                    Files.readAttributes(path,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey());}
            }
        }
        void closeWitnesses(){if(originalEpoch!=null)Arrays.fill(originalEpoch,(byte)0);}
    }
}
