package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.Test;

/** Three NEW post-repair guards; final 16/2 source inputs are unchanged and
 * not replayed. All encryption, actors/storage and timing remain synthetic. */
public final class NativeProviderDeliveryAdditionalGuardsTest {
    static void raw(NativeProviderDeliveryCensusTest.Fixture f,ProviderRecordStore.Key key,String body)throws Exception{
        char[] clear=body.toCharArray();var store=f.f.old.providerStore.store();
        try{store.commit(store.loadRetained().revision,Map.of(key,clear),Set.of());}finally{Arrays.fill(clear,'\0');}
    }
    @Test public void strictDecimalAndExponentVersionTypesCannotEnterIntegerV2ThroughOwningParserFallback()throws Exception{
        for(String spelling:new String[]{"2.0","2e0"}){
            var f=new NativeProviderDeliveryCensusTest.Fixture();f.admitted();String original=f.inbox().toString();
            assertTrue(original.contains("\"interval_version\":2"));String changed=original.replace("\"interval_version\":2","\"interval_version\":"+spelling);
            raw(f,f.inboxKey(),changed);var result=f.inspect();assertEquals(4,result.providerClassifiedRows);
            assertEquals(1,NativeProviderDeliveryCensusTest.count(result,"HISTORICAL_POINT_DELIVERY_UNRESOLVED_NOT_UPGRADED"));
        }
    }
    @Test public void identicalDuplicateEventJsonFieldsDoNotNormalizeIntoOriginalEventOrReceipt()throws Exception{
        var f=new NativeProviderDeliveryCensusTest.Fixture();f.admitted();String event=f.event("received").toString();
        String duplicate=event.substring(0,event.length()-1)+",\"state\":\"PENDING\"}";
        raw(f,f.key(ProviderEnvelopeCrypto.Domain.EVENT,f.eventId("received")),duplicate);
        var result=f.inspect();assertEquals(4,result.providerClassifiedRows);assertTrue(result.unresolvedRows>0);
        assertFalse(result.inventoryAcknowledged);assertFalse(result.keyRemovalAllowed);
    }
    @Test public void unknownNamespaceChangeDuringDeliveryLeafCannotPublishAllEightCensus()throws Exception{
        var f=new NativeProviderDeliveryCensusTest.Fixture();f.admitted();f.settle();var fixture=f.f.old.providerStore;
        var delegate=new ProviderEnvelopeCrypto(fixture.keys,()->fixture.memory.readAll().isEmpty(),fixture.lock);
        boolean[] armed={false},changed={false};int[] reads={0};List<char[]> clearReads=new ArrayList<>();
        var crypto=new ProviderRecordStore.Crypto(){
            public void initialize(){throw new AssertionError("no initialize/new key");}
            public ProviderEnvelopeCrypto.Envelope encrypt(ProviderEnvelopeCrypto.Domain domain,String id,char[] clear){throw new AssertionError("no write");}
            public char[] decrypt(ProviderEnvelopeCrypto.Domain domain,String id,ProviderEnvelopeCrypto.Envelope envelope)throws VaultFailure{
                char[] clear=delegate.decrypt(domain,id,envelope);clearReads.add(clear);
                if(armed[0]&&++reads[0]==30){changed[0]=true;f.f.other.get("WSSecureStorageSharedPreferences").put("late-delivery-source",17L);}return clear;
            }
        };
        var provider=new NativeProviderJournal(new ProviderRecordStore(fixture.memory,crypto,fixture.lock),fixture.lock);var owner=f.f.old.nativeOwner;
        try(var generation=owner.engine.observeOriginalNativeRetainedGeneration(owner.work,owner.principal,null,provider,f.f.old.generation.generationId);
            var namespaces=f.f.observe()){
            var stable=new NativeVaultProviderReferenceCensusTest.Stable(f.f);armed[0]=true;
            NativeVaultProviderReferenceCensusTest.denied(()->owner.engine.inspectOriginalCapturedVaultProviderReferences(generation,namespaces));
            assertTrue(changed[0]);stable.all.put("WSSecureStorageSharedPreferences",new HashMap<>(f.f.raw("WSSecureStorageSharedPreferences")));stable.check();
        }
        for(char[] clear:clearReads)assertArrayEquals(new char[clear.length],clear);f.f.old.wiped();
    }
}
