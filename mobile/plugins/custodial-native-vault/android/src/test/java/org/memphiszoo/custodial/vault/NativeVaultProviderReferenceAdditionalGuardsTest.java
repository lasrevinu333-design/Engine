package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.Test;

/** Four NEW source/typed-parser/late-mutation guards. Prior 12 and affected4
 * bytes are unchanged and not rerun. All source records, crypto and storage
 * are synthetic; no Android runtime/physical, server or key-removal proof. */
public final class NativeVaultProviderReferenceAdditionalGuardsTest {
    @Test public void vaultNamespaceChangeBetweenReadChecksFailsWithoutEditingOrRecapture()throws Exception{
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();Map<String,Object> expected=new HashMap<>(f.vault);
        int[] reads={0};SharedPreferences changing=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),
            new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
                if(!"getAll".equals(method.getName()))throw new AssertionError("no edit/get credential");
                var result=new HashMap<>(f.vault);if(++reads[0]==1)f.vault.put("late-native-original",17L);return result;
            });
        var adapter=new SharedPreferencesVaultPersistence(changing,f.codec);
        NativeVaultProviderReferenceCensusTest.denied(()->adapter.matchesCapturedOriginalSnapshot(expected,f.old.nativeOwner.persistence.current()));
        assertEquals(2,reads[0]);f.old.wiped();
    }
    @Test public void unknownNamespaceChangeDuringLateProviderValidationCannotPublishCensus()throws Exception{
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();var fixture=f.old.providerStore;
        var delegate=new ProviderEnvelopeCrypto(fixture.keys,()->fixture.memory.readAll().isEmpty(),fixture.lock);
        boolean[] armed={false},changed={false};int[] reads={0};List<char[]> clearReads=new ArrayList<>();
        var crypto=new ProviderRecordStore.Crypto(){
            public void initialize(){throw new AssertionError("no initialize/new key");}
            public ProviderEnvelopeCrypto.Envelope encrypt(ProviderEnvelopeCrypto.Domain domain,String id,char[] clear){throw new AssertionError("no write");}
            public char[] decrypt(ProviderEnvelopeCrypto.Domain domain,String id,ProviderEnvelopeCrypto.Envelope envelope)throws VaultFailure{
                char[] clear=delegate.decrypt(domain,id,envelope);clearReads.add(clear);
                if(armed[0]&&++reads[0]==20){changed[0]=true;f.other.get("WSSecureStorageSharedPreferences").put("late-private-row",17L);}return clear;
            }
        };
        var provider=new NativeProviderJournal(new ProviderRecordStore(fixture.memory,crypto,fixture.lock),fixture.lock);var owner=f.old.nativeOwner;
        try(var generation=owner.engine.observeOriginalNativeRetainedGeneration(owner.work,owner.principal,null,provider,f.old.generation.generationId);
            var namespaces=f.observe()){
            var stable=new NativeVaultProviderReferenceCensusTest.Stable(f);armed[0]=true;
            NativeVaultProviderReferenceCensusTest.denied(()->owner.engine.inspectOriginalCapturedVaultProviderReferences(generation,namespaces));
            assertTrue("late decode hook reached",changed[0]);stable.all.put("WSSecureStorageSharedPreferences",new HashMap<>(f.raw("WSSecureStorageSharedPreferences")));stable.check();
        }
        for(char[] clear:clearReads)assertArrayEquals(new char[clear.length],clear);f.old.wiped();
    }
    @Test public void duplicateOriginalTokenJsonFieldsAreUnknownNotSilentlyNormalized()throws Exception{
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();String original=f.record(f.token()).toString();
        String repeated=original.substring(0,original.length()-1)+",\"state\":\"UNBOUND_TOKEN\"}";
        char[] body=repeated.toCharArray();var store=f.old.providerStore.store();
        try{store.commit(store.loadRetained().revision,Map.of(f.token(),body),Set.of());}finally{Arrays.fill(body,'\0');}
        var result=f.inspect();assertEquals(2,result.providerClassifiedRows);
        assertEquals(1,NativeVaultProviderReferenceCensusTest.stateCount(result,"TOKEN_CAPTURE_SEMANTICS_UNRESOLVED_RETAINED"));
        assertEquals(1,NativeVaultProviderReferenceCensusTest.stateCount(result,"GENERATION_REFERENCE_SEMANTICS_UNRESOLVED_RETAINED"));
    }
    @Test public void tokenTypedIntegerStringAndStateRulesAreNotCoercedByJournalJsonAccessors()throws Exception{
        for(String field:new String[]{"capture_sequence","capture_epoch","state","token","token_digest"}){
            var f=new NativeVaultProviderReferenceCensusTest.Fixture();var token=f.record(f.token());
            token.put(field,field.equals("capture_sequence")?"1":field.equals("capture_epoch")?true:17);
            f.put(f.token(),token);var result=f.inspect();assertEquals(2,result.providerClassifiedRows);
            assertEquals(1,NativeVaultProviderReferenceCensusTest.stateCount(result,"TOKEN_CAPTURE_SEMANTICS_UNRESOLVED_RETAINED"));
        }
    }
}
