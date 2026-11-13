package org.memphiszoo.custodial.vault;

/** Native, compiled release inputs only. No HTTP, preference, Intent, bridge,
 * environment, reflection or mutable setter can add an admission. Evidence
 * hashes identify reviewed artifacts; their scientific/review sufficiency is a
 * release prerequisite, not something a syntactically valid hash proves.
 * The existing build gate includes this source in the native-vault digest and
 * binds packaged build.json to the exact source commit/tree and native version.
 * Do not embed that containing source digest here (a circular self-hash).
 */
final class NativeProviderReleaseAdmission {
    static final class Release {
        final long versionCode;
        final String versionName, backendProtocolEvidenceSha256, compositionEvidenceSha256;
        final NativeProviderTime.Profile profile;
        Release(long versionCode, String versionName, NativeProviderTime.Profile profile,
            String backendProtocolEvidenceSha256, String compositionEvidenceSha256) throws VaultFailure {
            if (versionCode <= 0 || versionCode > 2_100_000_000L || versionName == null
                || versionName.isEmpty() || versionName.length() > 64 || !versionName.equals(versionName.trim())
                || versionName.codePoints().anyMatch(Character::isISOControl) || profile == null
                || !digest(backendProtocolEvidenceSha256) || !digest(compositionEvidenceSha256)) throw invalid();
            this.versionCode = versionCode; this.versionName = versionName; this.profile = profile;
            this.backendProtocolEvidenceSha256 = backendProtocolEvidenceSha256;
            this.compositionEvidenceSha256 = compositionEvidenceSha256;
        }
        boolean matches(NativeProviderTime.Platform platform, NativeProviderAppIdentity app) {
            return app != null && app.versionCode == versionCode && app.versionName.equals(versionName)
                && profile.matches(platform);
        }
    }
    // Deliberately no invented target profile or reserved next release number.
    // An approved release must supply reviewed entries in this compiled source,
    // with exact platform q/rate/age evidence plus backend and owner proofs.
    private static final Release[] REVIEWED_RELEASES = NativeProviderReviewedReleases.entries();

    static final class Selected {
        private final Release release;
        private Selected(Release release) { this.release = release; }
        NativeProviderTime.Profiles profiles() {
            return actual -> release.profile.matches(actual) ? release.profile : null;
        }
        boolean matchesAudioEvidence(String clockFingerprint,String backend,String composition){
            try{return release.profile.fingerprint().equals(clockFingerprint)&&release.backendProtocolEvidenceSha256.equals(backend)
                &&release.compositionEvidenceSha256.equals(composition);}catch(VaultFailure invalid){return false;}
        }
    }
    interface OwnerFactory { NativeProviderRuntimeOwner create(NativeProviderTime.Profiles profiles) throws VaultFailure; }

    static boolean hasCompiledInputs() { return REVIEWED_RELEASES.length != 0; }
    static Selected compiled(NativeProviderTime.Platform platform, NativeProviderAppIdentity app) {
        return select(REVIEWED_RELEASES, platform, app);
    }
    /** Pure compiled-input seam, also exercised by synthetic qualification tests.
     * Production calls compiled(), never receives this array from a caller. */
    static Selected select(Release[] releases, NativeProviderTime.Platform platform, NativeProviderAppIdentity app) {
        if (releases == null || platform == null || app == null) return null;
        Release match = null;
        for (Release release : releases) {
            if (release == null) return null;
            if (release.matches(platform, app)) {
                if (match != null) return null; // Ambiguous evidence is not preference order.
                match = release;
            }
        }
        return match == null ? null : new Selected(match);
    }
    /** Admission precedes the factory: missing evidence cannot create a vault,
     * provider key/namespace, token request, network request or effects owner. */
    static NativeProviderRuntimeOwner open(Selected selected, OwnerFactory factory) throws VaultFailure {
        if (selected == null) return null;
        if (factory == null) throw invalid();
        return factory.create(selected.profiles());
    }
    private static boolean digest(String value) { return value != null && value.matches("[0-9a-f]{64}"); }
    private static VaultFailure invalid() { return new VaultFailure("custodial_provider_release_not_admitted"); }
    private NativeProviderReleaseAdmission() {}
}
