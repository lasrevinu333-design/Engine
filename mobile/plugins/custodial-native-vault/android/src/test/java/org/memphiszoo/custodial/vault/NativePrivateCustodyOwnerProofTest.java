package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.file.Files;
import org.junit.Test;

/** NEW closed owning proof cases only, explicit synthetic key adapter copy;
 * not current Android execution or replay of previous owner/capsule suites. */
public final class NativePrivateCustodyOwnerProofTest {
    @Test public void exactRepeatedMetadataProofUsesSameOriginalRecordNoNewNonceOrAttempt()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()) {f.commit();var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x.f.x);var files=NativePrivateCustodyOwnerTest.files(f.dir);
            try(var owner=f.inspect();var p=f.engine().prepareOriginalPrivateCustodyOwnerProof(owner);var again=f.engine().prepareOriginalPrivateCustodyOwnerProof(owner)) {
                assertEquals(p.projection().toString(),again.projection().toString());assertEquals(20,p.projection().length());
                assertEquals(owner.projection().getJSONObject("additional_protected_file_domain").getJSONObject("record").get("record_sha256"),p.projection().get("record_sha256"));
                assertFalse(p.projection().toString().contains("test-device-secret"));stable.check();NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
            }
        }
    }
    @Test public void missingClosedOrForeignOwnerNeverConstructsProof()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture();var absent=f.inspect()) {
            NativePrivateCustodyOwnerTest.denied(()->f.engine().prepareOriginalPrivateCustodyOwnerProof(null));
            NativePrivateCustodyOwnerTest.denied(()->f.engine().prepareOriginalPrivateCustodyOwnerProof(absent));assertFalse(Files.exists(f.dir));
            absent.close();NativePrivateCustodyOwnerTest.denied(()->f.engine().prepareOriginalPrivateCustodyOwnerProof(absent));
        }
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()) {f.commit();try(var owner=f.inspect()) {
            var other=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();NativePrivateCustodyOwnerTest.denied(()->other.f.engine().prepareOriginalPrivateCustodyOwnerProof(owner));other.f.x.f.preserved();
        }}
    }
    @Test public void closeOnlyProofDoesNotCloseOrDeleteOriginalOwnerAndFile()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();var files=NativePrivateCustodyOwnerTest.files(f.dir);try(var owner=f.inspect()) {
            var p=f.engine().prepareOriginalPrivateCustodyOwnerProof(owner);p.close();NativePrivateCustodyOwnerTest.denied(p::projection);
            owner.projection();NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);try(var fresh=f.engine().prepareOriginalPrivateCustodyOwnerProof(owner)){fresh.projection();}
        }}
    }
    @Test public void changedOriginalNamespaceInvalidatesSavedProofWithoutResigningOrDiscard()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();var files=NativePrivateCustodyOwnerTest.files(f.dir);try(var owner=f.inspect();var p=f.engine().prepareOriginalPrivateCustodyOwnerProof(owner)) {
            f.x.f.x.unknown.get("MemphisZooCustodialNativeVaultV1").put("new-unknown-source","synthetic");NativePrivateCustodyOwnerTest.denied(p::projection);
            NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
        }}
    }
    @Test public void replacedOriginalKeyInvalidatesProofPreservingCiphertextAndOldStores()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();var files=NativePrivateCustodyOwnerTest.files(f.dir);try(var owner=f.inspect();var p=f.engine().prepareOriginalPrivateCustodyOwnerProof(owner)) {
            NativePrivateCustodyOwnerTest.testKey("selectSyntheticKey",new Class<?>[]{int.class},2);NativePrivateCustodyOwnerTest.denied(p::projection);
            NativePrivateCustodyOwnerTest.sameFiles(files,f.dir);
        }}
    }
    @Test public void changedOriginalCiphertextInvalidatesProofNeverRepairsForeignBytes()throws Exception {
        try(var f=new NativePrivateCustodyOwnerTest.Fixture()){f.commit();try(var owner=f.inspect();var p=f.engine().prepareOriginalPrivateCustodyOwnerProof(owner)) {
            byte[] bytes=Files.readAllBytes(f.committed);bytes[bytes.length-1]^=1;Files.write(f.committed,bytes);
            NativePrivateCustodyOwnerTest.denied(p::projection);assertArrayEquals(bytes,Files.readAllBytes(f.committed));
        }}
    }
}
