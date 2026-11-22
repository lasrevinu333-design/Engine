package org.memphiszoo.custodial.vault;

/** Deterministic compiled counterpart of provider-reviewed-releases.json.
 * Validated byte-for-byte by native configuration; never loaded at runtime.
 * No real release is admitted until reviewed source inputs are supplied. */
final class NativeProviderReviewedReleases {
    static NativeProviderReleaseAdmission.Release[] entries() {
        try {
            return new NativeProviderReleaseAdmission.Release[] {
                new NativeProviderReleaseAdmission.Release(81L, "1.0.0",
                    NativeProviderTime.Profile.androidBestEffort("android-elapsed-best-effort.karen-api36.v1", new NativeProviderTime.Platform("android.os.SystemClock.elapsedRealtime/API-36", "motorola/kansas_g_sys/kansas:16/W1VKS36H.9-12-9-8-4/f30e05-4b081e:user/release-keys", "motorola/moto g - 2025/kansas/mt6835"), "ceda8cf79449c02fe434880ac76b3e8674414e2f1306006e7ea7ec90464ff798"),
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "10e30f9e404cf01ed0df40afbbeb634686ee03e9ec47764bb525ccf1d5520878"),
                new NativeProviderReleaseAdmission.Release(82L, "1.0.0",
                    NativeProviderTime.Profile.androidBestEffort("android-elapsed-best-effort.karen-api36.v1", new NativeProviderTime.Platform("android.os.SystemClock.elapsedRealtime/API-36", "motorola/kansas_g_sys/kansas:16/W1VKS36H.9-12-9-8-4/f30e05-4b081e:user/release-keys", "motorola/moto g - 2025/kansas/mt6835"), "ceda8cf79449c02fe434880ac76b3e8674414e2f1306006e7ea7ec90464ff798"),
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "70730a8cf2e0a197c69d5ae10c81b5c02b0104aa3684d6d7fdba8d21297b8602"),
                new NativeProviderReleaseAdmission.Release(83L, "1.0.0",
                    NativeProviderTime.Profile.androidBestEffort("android-elapsed-best-effort.karen-api36.v1", new NativeProviderTime.Platform("android.os.SystemClock.elapsedRealtime/API-36", "motorola/kansas_g_sys/kansas:16/W1VKS36H.9-12-9-8-4/f30e05-4b081e:user/release-keys", "motorola/moto g - 2025/kansas/mt6835"), "ceda8cf79449c02fe434880ac76b3e8674414e2f1306006e7ea7ec90464ff798"),
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "fb93e940f1a94d00bfd139a4c0e016234575845b5e49516656be53082221eaca"),
                new NativeProviderReleaseAdmission.Release(84L, "1.0.0",
                    NativeProviderTime.Profile.androidBestEffort("android-elapsed-best-effort.karen-api36.v1", new NativeProviderTime.Platform("android.os.SystemClock.elapsedRealtime/API-36", "motorola/kansas_g_sys/kansas:16/W1VKS36H.9-12-9-8-4/f30e05-4b081e:user/release-keys", "motorola/moto g - 2025/kansas/mt6835"), "ceda8cf79449c02fe434880ac76b3e8674414e2f1306006e7ea7ec90464ff798"),
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "8f7f6a0dda91457de7fc03c4db3e67c157616c63136f17e7919cfb620a767b2c"),
                new NativeProviderReleaseAdmission.Release(85L, "1.0.0",
                    NativeProviderTime.Profile.androidBestEffort("android-elapsed-best-effort.karen-api36.v1", new NativeProviderTime.Platform("android.os.SystemClock.elapsedRealtime/API-36", "motorola/kansas_g_sys/kansas:16/W1VKS36H.9-12-9-8-4/f30e05-4b081e:user/release-keys", "motorola/moto g - 2025/kansas/mt6835"), "ceda8cf79449c02fe434880ac76b3e8674414e2f1306006e7ea7ec90464ff798"),
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "3c130b1d1925d44484c9548f27da424e8385589aa90d9452211edaa96699426e")
            };
        } catch (VaultFailure invalid) { throw new ExceptionInInitializerError(invalid); }
    }
    private NativeProviderReviewedReleases() {}
}
