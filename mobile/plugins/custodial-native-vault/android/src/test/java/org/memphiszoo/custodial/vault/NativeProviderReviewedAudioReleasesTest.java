package org.memphiszoo.custodial.vault;

import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Synthetic compiled-input seams only. No device, real qualification or effects. */
public class NativeProviderReviewedAudioReleasesTest {
    private static String hash(char c) { return String.valueOf(c).repeat(64); }
    private static NativeProviderTime.Profile profile() throws VaultFailure {
        return new NativeProviderTime.Profile("SYNTHETIC_ONLY", new NativeProviderTime.Platform("synthetic-api","synthetic-build","synthetic-device"),1,1,1000000,hash('a'));
    }
    private static NativeProviderAppIdentity app() throws Exception {
        String commit="a".repeat(40);
        JSONObject build=new JSONObject().put("edition","custodial").put("source_commit_exact",true)
            .put("native_build_number",999).put("source_commit",commit).put("source_tree","b".repeat(40))
            .put("custodial_native_vault_source_sha256",hash('c')).put("build_id","synthetic.custodial."+commit.substring(0,12));
        return NativeProviderAppIdentity.fromPackaged(NativeProviderAppIdentity.PACKAGE,"SYNTHETIC_ONLY",999,build);
    }
    private static NativeProviderReleaseAdmission.Selected clock() throws Exception {
        NativeProviderTime.Profile p=profile();
        return NativeProviderReleaseAdmission.select(new NativeProviderReleaseAdmission.Release[]{
            new NativeProviderReleaseAdmission.Release(999,"SYNTHETIC_ONLY",p,hash('b'),hash('c'))},p.platform,app());
    }
    private static NativeProviderAudioPolicy policy() throws VaultFailure {
        return new NativeProviderAudioPolicy("synthetic.local.engine","SYNTHETIC_ONLY",900,hash('d'),hash('e'));
    }
    private static NativeProviderAudioAdmission.Entry entry(String clock,String backend,String composition,long version,NativeProviderAudioPolicy policy) throws VaultFailure {
        return new NativeProviderAudioAdmission.Entry(version,"SYNTHETIC_ONLY",clock,backend,composition,policy);
    }
    @Test public void actualEmptyReviewedRegistryNeverInventsAudioAdmission() throws Exception {
        assertEquals(0,NativeProviderReviewedAudioReleases.entries().length);
        assertNull(NativeProviderAudioAdmission.compiled(app(),clock()));
    }
    @Test public void syntheticEntryUsesExactNativeClockFingerprintAndEvidence() throws Exception {
        NativeProviderAudioPolicy p=policy();
        NativeProviderAudioAdmission.Entry e=entry(profile().fingerprint(),hash('b'),hash('c'),999,p);
        assertSame(p,NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[]{e},app(),clock()));
        assertEquals("900",Integer.toString(p.rateMilli));
    }
    @Test public void missingCrossedOrAmbiguousSyntheticEntriesFailClosed() throws Exception {
        NativeProviderAudioPolicy p=policy();String fingerprint=profile().fingerprint();
        NativeProviderAudioAdmission.Entry e=entry(fingerprint,hash('b'),hash('c'),999,p);
        assertNull(NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[0],app(),clock()));
        assertNull(NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[]{e,e},app(),clock()));
        assertNull(NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[]{null},app(),clock()));
        for(NativeProviderAudioAdmission.Entry bad:new NativeProviderAudioAdmission.Entry[]{
            entry(hash('f'),hash('b'),hash('c'),999,p),entry(fingerprint,hash('f'),hash('c'),999,p),
            entry(fingerprint,hash('b'),hash('f'),999,p),entry(fingerprint,hash('b'),hash('c'),998,p)})
            assertNull(NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[]{bad},app(),clock()));
        assertNull(NativeProviderAudioAdmission.select(new NativeProviderAudioAdmission.Entry[]{e},app(),null));
    }
    @Test public void malformedSyntheticAudioPoliciesRemainRejected() throws Exception {
        assertThrows(VaultFailure.class,()->new NativeProviderAudioPolicy("invalid","SYNTHETIC_ONLY",900,hash('d'),hash('e')));
        assertThrows(VaultFailure.class,()->new NativeProviderAudioPolicy("synthetic.local.engine","SYNTHETIC_ONLY",899,hash('d'),hash('e')));
        assertThrows(VaultFailure.class,()->new NativeProviderAudioPolicy("synthetic.local.engine","SYNTHETIC_ONLY",900,"bad",hash('e')));
    }
}
