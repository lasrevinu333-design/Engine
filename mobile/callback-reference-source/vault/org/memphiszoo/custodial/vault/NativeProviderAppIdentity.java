package org.memphiszoo.custodial.vault;

import org.json.JSONObject;

/** Packaged native identity only. A JS build/profile argument is never an input. */
final class NativeProviderAppIdentity {
    static final String PACKAGE = "org.memphiszoo.custodial";
    final String versionName, buildId;
    final long versionCode;
    private NativeProviderAppIdentity(String versionName, long versionCode, String buildId) {
        this.versionName = versionName; this.versionCode = versionCode; this.buildId = buildId;
    }
    static NativeProviderAppIdentity fromPackaged(String packageName, String versionName, long versionCode, JSONObject build) throws VaultFailure {
        try {
            if (!PACKAGE.equals(packageName) || versionCode <= 0 || versionCode > 2_100_000_000L
                || versionName == null || versionName.isEmpty() || versionName.length() > 64
                || !versionName.equals(versionName.trim()) || versionName.codePoints().anyMatch(Character::isISOControl)
                || build == null || !"custodial".equals(build.get("edition")) || !Boolean.TRUE.equals(build.get("source_commit_exact"))) throw invalid();
            Object embeddedVersion = build.get("native_build_number");
            if (!(embeddedVersion instanceof Integer || embeddedVersion instanceof Long) || ((Number) embeddedVersion).longValue() != versionCode) throw invalid();
            for (String field : new String[]{"source_commit", "source_tree"})
                if (!(build.get(field) instanceof String) || !build.getString(field).matches("[a-f0-9]{40}")) throw invalid();
            if (!(build.get("custodial_native_vault_source_sha256") instanceof String)
                || !build.getString("custodial_native_vault_source_sha256").matches("[a-f0-9]{64}")) throw invalid();
            Object identity = build.get("build_id");
            if (!(identity instanceof String) || !((String) identity).matches("[A-Za-z0-9._-]{1,200}")
                || !((String) identity).endsWith(".custodial." + build.getString("source_commit").substring(0, 12))) throw invalid();
            return new NativeProviderAppIdentity(versionName, versionCode, (String) identity);
        } catch (VaultFailure failure) { throw failure; }
        catch (Exception failure) { throw new VaultFailure("custodial_provider_native_build_identity_invalid", failure); }
    }
    JSONObject json() throws VaultFailure {
        try { return new JSONObject().put("package_name", PACKAGE).put("version_name", versionName).put("version_code", versionCode).put("build_id", buildId); }
        catch (Exception error) { throw new VaultFailure("custodial_provider_native_build_identity_invalid", error); }
    }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_native_build_identity_invalid"); }
}
