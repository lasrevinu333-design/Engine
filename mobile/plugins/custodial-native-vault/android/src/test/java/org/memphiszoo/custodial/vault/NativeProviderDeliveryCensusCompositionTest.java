package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import org.junit.Test;

/** Two NEW affected owning compositions after delivery leaf registration,
 * not a rerun of the previous 12/4/4 vault/provider or older native/browser/SQL.
 * The synthetic inputs and read-only interface boundaries remain explicit. */
public final class NativeProviderDeliveryCensusCompositionTest {
    @Test public void emptyDeliveryExtensionPreservesOriginalVaultMetadataTokenAndGenerationReferences()throws Exception{
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();var result=f.inspect();
        assertEquals(1,result.vaultBoundRows);assertEquals(4,result.providerClassifiedRows);
        assertEquals(f.total(),result.recordCount);assertFalse(result.completeNamespaceInventory);
    }
    @Test public void samePrivateAllEightCaptureJoinsDeliveryFactsWithoutChangingJournalOrGrantingKeyRelease()throws Exception{
        var f=new NativeProviderDeliveryCensusTest.Fixture();f.admitted();f.action("displayed");
        var before=new NativeVaultProviderReferenceCensusTest.Stable(f.f);
        try(var original=f.f.old.observe();var namespaces=f.f.observe()){
            var result=f.f.old.nativeOwner.engine.inspectOriginalCapturedVaultProviderReferences(original,namespaces);
            before.check();NativeVaultProviderReferenceCensusTest.noAuthority(result);assertEquals(7,result.providerClassifiedRows);
            assertEquals(f.f.total(),result.recordCount);assertEquals(4,result.json().getJSONArray("key_family_references").length());
            assertFalse(result.currentServerReadback);assertFalse(result.inventoryAcknowledged);assertFalse(result.keyRemovalAllowed);
        }f.f.old.wiped();
    }
}
