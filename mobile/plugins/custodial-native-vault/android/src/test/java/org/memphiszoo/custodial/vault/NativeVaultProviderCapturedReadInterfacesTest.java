package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.Test;

/** Four NEW affected native-only captured read interfaces. Private uncertain
 * map injection is a synthetic isolated fault, never an actual phone mutation.
 * No Android load/commit/Base64 runtime, key initialization or old suite rerun. */
public final class NativeVaultProviderCapturedReadInterfacesTest {
    @Test public void vaultReaderRequiresExactOriginalCodecAndWholeBoundNamespaceWithoutAnyEdit()throws Exception{
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();var original=f.old.nativeOwner.persistence.current();
        Map<String,Object> captured=new HashMap<>(f.vault);assertTrue(f.adapter.matchesCapturedOriginalSnapshot(captured,original));
        captured.put("omitted-row","new");NativeVaultProviderReferenceCensusTest.denied(()->f.adapter.matchesCapturedOriginalSnapshot(captured,original));
        f.vault.put(NativeVaultProviderReferenceCensus.SNAPSHOT,"wrong wire");var changed=new HashMap<>(f.vault);
        assertFalse(f.adapter.matchesCapturedOriginalSnapshot(changed,original));assertEquals(1,f.old.providerStore.keys.creations);f.old.wiped();
    }
    @Test public void pendingUncertainCommitCannotBecomeSourceAuthenticatedByMatchingMemoryBytes()throws Exception{
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();var original=f.old.nativeOwner.persistence.current();
        Field field=SharedPreferencesVaultPersistence.class.getDeclaredField("UNCERTAIN");field.setAccessible(true);
        @SuppressWarnings("unchecked") Map<Object,Object> uncertain=(Map<Object,Object>)field.get(null);
        Class<?> pending=Class.forName("org.memphiszoo.custodial.vault.SharedPreferencesVaultPersistence$PendingCommit");
        Constructor<?> constructor=pending.getDeclaredConstructor(long.class,String.class);constructor.setAccessible(true);
        assertFalse(uncertain.containsKey(f.preferences));uncertain.put(f.preferences,constructor.newInstance(original.revision-1,(String)f.vault.get(NativeVaultProviderReferenceCensus.SNAPSHOT)));
        try{NativeVaultProviderReferenceCensusTest.denied(()->f.adapter.matchesCapturedOriginalSnapshot(new HashMap<>(f.vault),original));}
        finally{uncertain.remove(f.preferences);}
        assertTrue(f.adapter.matchesCapturedOriginalSnapshot(new HashMap<>(f.vault),original));f.old.wiped();
    }
    @Test public void retainedProviderSnapshotHasNoInitializeEncryptOrCommitAndChecksExactEveryRow()throws Exception{
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();var fixture=f.old.providerStore;
        var crypto=new ProviderEnvelopeCrypto(fixture.keys,()->fixture.memory.readAll().isEmpty(),fixture.lock);
        List<char[]> reads=new ArrayList<>();
        var protectedCrypto=new ProviderRecordStore.Crypto(){
            public void initialize(){throw new AssertionError("new key/initialize forbidden");}
            public ProviderEnvelopeCrypto.Envelope encrypt(ProviderEnvelopeCrypto.Domain domain,String id,char[] text){throw new AssertionError("write forbidden");}
            public char[] decrypt(ProviderEnvelopeCrypto.Domain domain,String id,ProviderEnvelopeCrypto.Envelope envelope)throws VaultFailure{
                char[] plain=crypto.decrypt(domain,id,envelope);reads.add(plain);return plain;
            }
        };
        var store=new ProviderRecordStore(fixture.memory,protectedCrypto,fixture.lock);var before=new HashMap<>(fixture.memory.raw);
        int commits=fixture.memory.commits,keys=fixture.keys.creations;
        assertEquals(before.size()-1,store.loadRetainedCaptured(before).keys().size());
        Map<String,Object> omitted=new HashMap<>(before);omitted.remove("TOKEN:capture-1");
        NativeVaultProviderReferenceCensusTest.denied(()->store.loadRetainedCaptured(omitted));
        assertEquals(before,fixture.memory.raw);assertEquals(commits,fixture.memory.commits);assertEquals(keys,fixture.keys.creations);
        for(char[] plain:reads)assertArrayEquals(new char[plain.length],plain);f.old.wiped();
    }
    @Test public void providerMissingExistingKeyAndSourceMutationDuringDecryptFailWithoutRepair()throws Exception{
        for(boolean missing:new boolean[]{true,false}){
            var f=new NativeVaultProviderReferenceCensusTest.Fixture();var fixture=f.old.providerStore;
            var crypto=new ProviderEnvelopeCrypto(fixture.keys,()->fixture.memory.readAll().isEmpty(),fixture.lock);
            var protectedCrypto=new ProviderRecordStore.Crypto(){
                boolean changed;
                public void initialize(){throw new AssertionError("initialize forbidden");}
                public ProviderEnvelopeCrypto.Envelope encrypt(ProviderEnvelopeCrypto.Domain domain,String id,char[] text){throw new AssertionError("write forbidden");}
                public char[] decrypt(ProviderEnvelopeCrypto.Domain domain,String id,ProviderEnvelopeCrypto.Envelope envelope)throws VaultFailure{
                    char[] plain=crypto.decrypt(domain,id,envelope);
                    if(!missing&&!changed){changed=true;fixture.memory.raw.put("late-hidden-source-row","unknown retained");}return plain;
                }
            };
            var store=new ProviderRecordStore(fixture.memory,protectedCrypto,fixture.lock);var before=new HashMap<>(fixture.memory.raw);
            int commits=fixture.memory.commits,keys=fixture.keys.creations;if(missing)fixture.keys.value=null;
            NativeVaultProviderReferenceCensusTest.denied(()->store.loadRetainedCaptured(before));
            assertEquals(commits,fixture.memory.commits);assertEquals(keys,fixture.keys.creations);f.old.wiped();
        }
    }
}
