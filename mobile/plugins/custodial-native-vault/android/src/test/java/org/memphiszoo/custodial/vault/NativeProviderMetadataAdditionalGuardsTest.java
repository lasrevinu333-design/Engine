package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.junit.Test;

/** Two NEW late-capture guards. Metadata source inputs and the sixteen
 * first-run pass/two repaired method/three composition inputs are unchanged.
 * All external-change simulations affect only synthetic fixture maps. */
public final class NativeProviderMetadataAdditionalGuardsTest {
    static void changedDuringCapturedRead(boolean providerChange)throws Exception{
        var x=new NativeProviderMetadataCensusTest.Fixture();x.savedClock();x.scan();x.diagnostic();var fixture=x.f.old.providerStore;
        var delegate=new ProviderEnvelopeCrypto(fixture.keys,()->fixture.memory.readAll().isEmpty(),fixture.lock);
        boolean[] armed={false},changed={false};int[] clockReads={0};List<char[]> buffers=new ArrayList<>();
        var crypto=new ProviderRecordStore.Crypto(){
            public void initialize(){throw new AssertionError("census cannot initialize/key-create");}
            public ProviderEnvelopeCrypto.Envelope encrypt(ProviderEnvelopeCrypto.Domain domain,String id,char[] clear){throw new AssertionError("census cannot encrypt/write");}
            public char[] decrypt(ProviderEnvelopeCrypto.Domain domain,String id,ProviderEnvelopeCrypto.Envelope envelope)throws VaultFailure{
                char[] clear=delegate.decrypt(domain,id,envelope);buffers.add(clear);
                if(armed[0]&&!changed[0]&&domain==ProviderEnvelopeCrypto.Domain.METADATA&&id.equals(x.clockKey().id)&&++clockReads[0]==3){
                    changed[0]=true;
                    if(providerChange)fixture.memory.raw.put("METADATA:foreign-late-original-clock", "opaque corrupt original");
                    else x.f.other.get("WSSecureStorageSharedPreferences").put("late-metadata-unknown-original",23L);
                }
                return clear;
            }
        };
        var provider=new NativeProviderJournal(new ProviderRecordStore(fixture.memory,crypto,fixture.lock),fixture.lock);var owner=x.f.old.nativeOwner;
        try(var generation=owner.engine.observeOriginalNativeRetainedGeneration(owner.work,owner.principal,null,provider,x.f.old.generation.generationId);
            var namespaces=x.f.observe()){
            var stable=new NativeVaultProviderReferenceCensusTest.Stable(x.f);armed[0]=true;
            NativeVaultProviderReferenceCensusTest.denied(()->owner.engine.inspectOriginalCapturedVaultProviderReferences(generation,namespaces));assertTrue(changed[0]);
            String name=providerChange?NativeVaultProviderReferenceCensus.PROVIDER:"WSSecureStorageSharedPreferences";
            stable.all.put(name,new HashMap<>(x.f.raw(name)));stable.check();
        }
        for(char[] clear:buffers)assertArrayEquals(new char[clear.length],clear);x.f.old.wiped();
    }
    @Test public void providerSourceAdditionDuringCapturedClockReadCannotPublishCensus()throws Exception{changedDuringCapturedRead(true);}
    @Test public void unknownSecureStorageSourceChangeDuringMetadataReadCannotPublishCensus()throws Exception{changedDuringCapturedRead(false);}
}
