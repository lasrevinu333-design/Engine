package org.memphiszoo.custodial.vault;

/** Deterministic compiled counterpart of provider-reviewed-releases.json.
 * Validated byte-for-byte by native configuration; never loaded at runtime.
 * No real release is admitted until reviewed source inputs are supplied. */
final class NativeProviderReviewedReleases {
    static NativeProviderReleaseAdmission.Release[] entries() {
        try {
            return new NativeProviderReleaseAdmission.Release[] {
                new NativeProviderReleaseAdmission.Release(80L, "1.0.0",
                    NativeProviderTime.Profile.androidBestEffort("android-elapsed-best-effort.karen-api36.v1", new NativeProviderTime.Platform("android.os.SystemClock.elapsedRealtime/API-36", "motorola/kansas_g_sys/kansas:16/W1VKS36H.9-12-9-8-4/f30e05-4b081e:user/release-keys", "motorola/moto g - 2025/kansas/mt6835"), "ceda8cf79449c02fe434880ac76b3e8674414e2f1306006e7ea7ec90464ff798"),
                    "bf1981760b4b0955de7159726112bb69baeef8f9558b6bef014cea8ebd8fb2ac", "327a9a0ba342f5e853b090defcc21469642f3acf7dc3f6e6a62eeb92a9a85401")
            };
        } catch (VaultFailure invalid) { throw new ExceptionInInitializerError(invalid); }
    }
    private NativeProviderReviewedReleases() {}
}
