package org.memphiszoo.custodial.vault;

/** Deterministic compiled counterpart of provider-reviewed-audio-releases.json.
 * Source-only reviewed inputs; never preferences, HTTP, Intent or WebView data.
 * Hash bindings do not independently establish qualification or approval. */
final class NativeProviderReviewedAudioReleases {
    static NativeProviderAudioAdmission.Entry[] entries() {
        try {
            return new NativeProviderAudioAdmission.Entry[] {
                new NativeProviderAudioAdmission.Entry(81L, "1.0.0", "a553099d48713282b58a9bb9e07dd51f0bce32471d60de208c2c13aa1b69d785",
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "10e30f9e404cf01ed0df40afbbeb634686ee03e9ec47764bb525ccf1d5520878",
                    new NativeProviderAudioPolicy("com.google.android.tts", "en-us-x-iol-local", 900, "baf1e5dc9bda891e8482a8369ce339783012324e48120206801eb096e8ffef98", "89284af13afbbf2db7c2404d328aaf45ba8b98e093580db15f1c9fad80fa5f82")),
                new NativeProviderAudioAdmission.Entry(82L, "1.0.0", "a553099d48713282b58a9bb9e07dd51f0bce32471d60de208c2c13aa1b69d785",
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "70730a8cf2e0a197c69d5ae10c81b5c02b0104aa3684d6d7fdba8d21297b8602",
                    new NativeProviderAudioPolicy("com.google.android.tts", "en-us-x-iol-local", 900, "baf1e5dc9bda891e8482a8369ce339783012324e48120206801eb096e8ffef98", "89284af13afbbf2db7c2404d328aaf45ba8b98e093580db15f1c9fad80fa5f82")),
                new NativeProviderAudioAdmission.Entry(83L, "1.0.0", "a553099d48713282b58a9bb9e07dd51f0bce32471d60de208c2c13aa1b69d785",
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "fb93e940f1a94d00bfd139a4c0e016234575845b5e49516656be53082221eaca",
                    new NativeProviderAudioPolicy("com.google.android.tts", "en-us-x-iol-local", 900, "baf1e5dc9bda891e8482a8369ce339783012324e48120206801eb096e8ffef98", "89284af13afbbf2db7c2404d328aaf45ba8b98e093580db15f1c9fad80fa5f82")),
                new NativeProviderAudioAdmission.Entry(84L, "1.0.0", "a553099d48713282b58a9bb9e07dd51f0bce32471d60de208c2c13aa1b69d785",
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "8f7f6a0dda91457de7fc03c4db3e67c157616c63136f17e7919cfb620a767b2c",
                    new NativeProviderAudioPolicy("com.google.android.tts", "en-us-x-iol-local", 900, "baf1e5dc9bda891e8482a8369ce339783012324e48120206801eb096e8ffef98", "89284af13afbbf2db7c2404d328aaf45ba8b98e093580db15f1c9fad80fa5f82")),
                new NativeProviderAudioAdmission.Entry(85L, "1.0.0", "a553099d48713282b58a9bb9e07dd51f0bce32471d60de208c2c13aa1b69d785",
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "3c130b1d1925d44484c9548f27da424e8385589aa90d9452211edaa96699426e",
                    new NativeProviderAudioPolicy("com.google.android.tts", "en-us-x-iol-local", 900, "baf1e5dc9bda891e8482a8369ce339783012324e48120206801eb096e8ffef98", "89284af13afbbf2db7c2404d328aaf45ba8b98e093580db15f1c9fad80fa5f82")),
                new NativeProviderAudioAdmission.Entry(86L, "1.0.0", "a553099d48713282b58a9bb9e07dd51f0bce32471d60de208c2c13aa1b69d785",
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "7a4cf3788e3fd297c38ef762c94b9effdacfe14cee385de0d16b33098c55a75d",
                    new NativeProviderAudioPolicy("com.google.android.tts", "en-us-x-iol-local", 900, "baf1e5dc9bda891e8482a8369ce339783012324e48120206801eb096e8ffef98", "89284af13afbbf2db7c2404d328aaf45ba8b98e093580db15f1c9fad80fa5f82")),
                new NativeProviderAudioAdmission.Entry(87L, "1.0.0", "a553099d48713282b58a9bb9e07dd51f0bce32471d60de208c2c13aa1b69d785",
                    "54d3a2f47a70aba0cad96477704feb38b63d7794593a91ee7cd1c223fd1ba952", "7aa1cc223c7c373104fb68733c01dec358e3abbd6c4ba467d4658b2f52bbee78",
                    new NativeProviderAudioPolicy("com.google.android.tts", "en-us-x-iol-local", 900, "baf1e5dc9bda891e8482a8369ce339783012324e48120206801eb096e8ffef98", "89284af13afbbf2db7c2404d328aaf45ba8b98e093580db15f1c9fad80fa5f82"))
            };
        } catch (VaultFailure invalid) { throw new ExceptionInInitializerError(invalid); }
    }
    private NativeProviderReviewedAudioReleases() {}
}
