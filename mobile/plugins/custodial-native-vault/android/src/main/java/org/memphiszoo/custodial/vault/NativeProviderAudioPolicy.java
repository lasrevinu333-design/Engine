package org.memphiszoo.custodial.vault;

/** Source-compiled accepted local voice and shared asset. Never a preference,
 * Intent, HTTP or JS override. A digest is a binding, not independent approval. */
final class NativeProviderAudioPolicy {
    static final String TONE_ASSET="public/memphis-alert-tone.wav";
    final String engine,voice,toneSha256,evidenceSha256;
    final int rateMilli;
    NativeProviderAudioPolicy(String engine,String voice,int rateMilli,String toneSha256,String evidenceSha256)throws VaultFailure{
        if(engine==null||!engine.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+)+")
            ||voice==null||!voice.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,179}")||rateMilli!=900
            ||toneSha256==null||!toneSha256.matches("[a-f0-9]{64}")||evidenceSha256==null||!evidenceSha256.matches("[a-f0-9]{64}"))
            throw new VaultFailure("custodial_provider_audio_policy_unqualified");
        this.engine=engine;this.voice=voice;this.rateMilli=rateMilli;this.toneSha256=toneSha256;this.evidenceSha256=evidenceSha256;
    }
}
