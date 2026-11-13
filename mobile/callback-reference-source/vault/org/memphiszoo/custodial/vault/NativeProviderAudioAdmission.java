package org.memphiszoo.custodial.vault;

/** Separate complete effect admission paired with the existing qualified clock.
 * No real entry is invented. Missing evidence stops before namespace/service. */
final class NativeProviderAudioAdmission {
    static final class Entry {
        final long versionCode;final String versionName,clockFingerprint,backendSha256,compositionSha256;
        final NativeProviderAudioPolicy policy;
        Entry(long code,String name,String clockFingerprint,String backend,String composition,NativeProviderAudioPolicy policy)throws VaultFailure{
            if(code<1||code>2100000000L||name==null||name.isEmpty()||name.length()>64||policy==null
                ||!digest(clockFingerprint)||!digest(backend)||!digest(composition))throw new VaultFailure("custodial_provider_audio_policy_unqualified");
            versionCode=code;versionName=name;this.clockFingerprint=clockFingerprint;backendSha256=backend;compositionSha256=composition;this.policy=policy;
        }
    }
    private static final Entry[] REVIEWED_AUDIO_RELEASES=NativeProviderReviewedAudioReleases.entries();
    static NativeProviderAudioPolicy compiled(NativeProviderAppIdentity app,NativeProviderReleaseAdmission.Selected clock){return select(REVIEWED_AUDIO_RELEASES,app,clock);}
    static NativeProviderAudioPolicy select(Entry[] entries,NativeProviderAppIdentity app,NativeProviderReleaseAdmission.Selected clock){
        if(entries==null||app==null||clock==null)return null;Entry found=null;
        for(Entry e:entries){if(e==null)return null;if(e.versionCode==app.versionCode&&e.versionName.equals(app.versionName)
            &&clock.matchesAudioEvidence(e.clockFingerprint,e.backendSha256,e.compositionSha256)){if(found!=null)return null;found=e;}}
        return found==null?null:found.policy;
    }
    private static boolean digest(String s){return s!=null&&s.matches("[a-f0-9]{64}");}
}
