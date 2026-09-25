package org.memphiszoo.custodial.vault;

import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderAppIdentityTest {
    static JSONObject packaged(long version) throws Exception {
        return new JSONObject().put("edition", "custodial").put("native_build_number", version)
            .put("source_commit_exact", true).put("source_commit", "a".repeat(40)).put("source_tree", "b".repeat(40))
            .put("custodial_native_vault_source_sha256", "c".repeat(64)).put("build_id", "synthetic.custodial." + "a".repeat(12));
    }
    static NativeProviderAppIdentity identity(long version) throws Exception {
        return NativeProviderAppIdentity.fromPackaged(NativeProviderAppIdentity.PACKAGE, "0.0.0-synthetic", version, packaged(version));
    }
    @Test public void nativePackageVersionAndImmutableAssetBindExactMetadata() throws Exception {
        NativeProviderAppIdentity identity = identity(53); JSONObject record = identity.json();
        assertEquals(4, record.length()); assertEquals(NativeProviderAppIdentity.PACKAGE, record.getString("package_name"));
        assertEquals(53, record.getLong("version_code")); assertEquals("0.0.0-synthetic", record.getString("version_name"));
        assertEquals("synthetic.custodial." + "a".repeat(12), record.getString("build_id"));
        record.put("build_id", "caller edit"); assertNotEquals(record.getString("build_id"), identity.json().getString("build_id"));
    }
    @Test public void wrongPackageVersionDirtySourceOrBuildCannotRegister() throws Exception {
        for (String field : new String[]{"edition", "native_build_number", "source_commit_exact", "source_commit", "source_tree",
            "custodial_native_vault_source_sha256", "build_id"}) {
            JSONObject changed = packaged(53);
            changed.put(field, field.equals("native_build_number") ? 54 : field.equals("source_commit_exact") ? false : "wrong");
            ProviderRecordStoreTest.failure("custodial_provider_native_build_identity_invalid", () -> NativeProviderAppIdentity.fromPackaged(
                NativeProviderAppIdentity.PACKAGE, "1", 53, changed));
        }
        for (String name : new String[]{"org.memphiszoo.infrastructure", "org.memphiszoo.custodial.debug", ""})
            ProviderRecordStoreTest.failure("custodial_provider_native_build_identity_invalid", () -> NativeProviderAppIdentity.fromPackaged(name, "1", 53, packaged(53)));
        for (long code : new long[]{0, -1, 2100000001L})
            ProviderRecordStoreTest.failure("custodial_provider_native_build_identity_invalid", () -> NativeProviderAppIdentity.fromPackaged(
                NativeProviderAppIdentity.PACKAGE, "1", code, packaged(code)));
        for (Object version : new Object[]{"53", 53.0, true, JSONObject.NULL})
            ProviderRecordStoreTest.failure("custodial_provider_native_build_identity_invalid", () -> NativeProviderAppIdentity.fromPackaged(
                NativeProviderAppIdentity.PACKAGE, "1", 53, packaged(53).put("native_build_number", version)));
    }
    @Test public void pendingOperationRetainsOriginalBuildAcrossNativeAppUpdate() throws Exception {
        NativeProviderJournalTest.Fixture f = new NativeProviderJournalTest.Fixture(); NativeProviderPrincipal p = NativeProviderJournalTest.v1();
        f.journal().captureToken("token"); f.journal().observeActivePrincipal(p);
        NativeProviderJournal.Prepared original = f.journal().prepareRegistration(p, identity(53));
        NativeProviderJournal.Prepared pending = f.journal().prepareRegistration(p, identity(54));
        assertEquals(original.operationId, pending.operationId); assertEquals(53, pending.json().getJSONObject("native_app").getLong("version_code"));
        ProviderRecordStoreTest.failure("custodial_provider_native_build_identity_invalid", () -> f.journal().prepareRegistration(p, null));
    }
}
