package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import org.junit.Test;

/** Three NEW owning-interface compositions for metadata registration/revision
 * binding. Previous passing native/browser/provider/SQL proofs not rerun. */
public final class NativeProviderMetadataCensusCompositionTest {
    @Test public void emptyExtensionKeepsExactOwningSnapshotAndEveryOriginalRawRow()throws Exception{
        var x=new NativeProviderMetadataCensusTest.Fixture();var result=x.inspect();
        assertEquals(4,result.providerClassifiedRows);assertEquals(1,result.vaultBoundRows);assertEquals(x.f.total(),result.recordCount);
    }
    @Test public void combinedClockRecoveryAndDiagnosticCensusPreservesAllEightAndKeyReferences()throws Exception{
        var x=new NativeProviderMetadataCensusTest.Fixture();x.savedClock();x.scan();x.diagnostic();
        var before=new NativeVaultProviderReferenceCensusTest.Stable(x.f);
        try(var generation=x.f.old.observe();var namespaces=x.f.observe()){
            var result=x.f.old.nativeOwner.engine.inspectOriginalCapturedVaultProviderReferences(generation,namespaces);before.check();
            NativeVaultProviderReferenceCensusTest.noAuthority(result);assertEquals(7,result.providerClassifiedRows);
            assertEquals(x.f.total(),result.recordCount);assertEquals(4,result.json().getJSONArray("key_family_references").length());
            assertFalse(result.completeNamespaceInventory);assertFalse(result.inventoryAcknowledged);assertFalse(result.keyRemovalAllowed);
        }x.f.old.wiped();
    }
    @Test public void newlyBoundMetadataLeafDoesNotHideDeliveryGraphOrGrantEffects()throws Exception{
        var x=new NativeProviderDeliveryCensusTest.Fixture();x.admitted();
        x.f.put(ProviderRecordStore.DIAGNOSTIC,new org.json.JSONObject().put("schema","custodial.native-provider-journal.v1")
            .put("recovery_needed",true).put("reason","CAPACITY_PRESERVED"));var result=x.inspect();
        assertEquals(7,result.providerClassifiedRows);assertEquals(1,NativeProviderDeliveryCensusTest.count(result,
            "ORIGINAL_INBOX_PAYLOAD_ACTION_AND_PENDING_EFFECT_FACTS_LOCAL_ONLY"));assertEquals(1,NativeProviderDeliveryCensusTest.count(result,
            "LOCAL_CAPACITY_DIAGNOSTIC_NOT_RECOVERY_SETTLEMENT"));
    }
}
