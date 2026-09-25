package org.memphiszoo.custodial.vault;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Arrays;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/** Real JCE AES-GCM with synthetic keys; NOT AndroidKeyStore instrumentation. */
public final class ProviderEnvelopeCryptoTest {
    static final class Keys implements ProviderEnvelopeCrypto.Keys {
        SecretKey key; int created; boolean broken;
        @Override public SecretKey existing() throws Exception { if (broken) throw new Exception("synthetic keystore unavailable"); return key; }
        @Override public SecretKey createInEmptyNamespace() throws Exception { created++; key=KeyGenerator.getInstance("AES").generateKey();return key; }
    }
    static final class Fixture {
        final Keys keys=new Keys(); final Object lock=new Object(); boolean empty=true;
        ProviderEnvelopeCrypto instance() { return new ProviderEnvelopeCrypto(keys,()->empty,lock); }
    }
    interface Attempt { void run() throws Exception; }
    static void denied(String code,Attempt attempt) throws Exception {
        try { attempt.run(); fail("unsafe provider crypto operation admitted"); }
        catch(VaultFailure failure) { assertEquals(code,failure.code); }
    }
    static final ProviderEnvelopeCrypto.Domain TYPE=ProviderEnvelopeCrypto.Domain.INBOX;
    static final String ID="10000000-0000-4000-8000-000000000001";
    static final char[] TEXT="Synthetic saved notification — no production token".toCharArray();

    @Test public void newEmptyNamespaceCreatesExactlyOneKeyAcrossObjectRestart() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();f.instance().initialize();assertEquals(1,f.keys.created);
    }
    @Test public void nonemptyMissingKeyIsPreservedAndNeverRecreated() throws Exception {
        Fixture f=new Fixture();f.empty=false;
        denied("custodial_provider_key_missing_preserved",()->f.instance().initialize());assertEquals(0,f.keys.created);
    }
    @Test public void readsAndWritesCannotCreateEvenAnEmptyNamespaceKey() throws Exception {
        Fixture f=new Fixture();
        denied("custodial_provider_key_missing_preserved",()->f.instance().encrypt(TYPE,ID,TEXT));assertEquals(0,f.keys.created);
    }
    @Test public void keyFailureCannotBecomeAnEmptyStore() throws Exception {
        Fixture f=new Fixture();f.keys.broken=true;
        denied("custodial_provider_key_unavailable_preserved",()->f.instance().initialize());assertEquals(0,f.keys.created);
    }
    @Test public void realAesRoundTripSurvivesAdapterRecreation() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();
        ProviderEnvelopeCrypto.Envelope e=f.instance().encrypt(TYPE,ID,TEXT);f.empty=false;
        assertArrayEquals(TEXT,f.instance().decrypt(TYPE,ID,e));assertEquals(1,f.keys.created);
    }
    @Test public void allDomainsRoundTripAndCrossDomainReplayIsDenied() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();
        for(ProviderEnvelopeCrypto.Domain domain:ProviderEnvelopeCrypto.Domain.values()) {
            ProviderEnvelopeCrypto.Envelope e=f.instance().encrypt(domain,ID,TEXT);
            assertArrayEquals(TEXT,f.instance().decrypt(domain,ID,e));
            for(ProviderEnvelopeCrypto.Domain other:ProviderEnvelopeCrypto.Domain.values())if(other!=domain)
                denied("custodial_provider_corrupt_preserved",()->f.instance().decrypt(other,ID,e));
        }
    }
    @Test public void recordIdReplayIsDenied() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();ProviderEnvelopeCrypto.Envelope e=f.instance().encrypt(TYPE,ID,TEXT);
        denied("custodial_provider_corrupt_preserved",()->f.instance().decrypt(TYPE,ID+"-other",e));
    }
    @Test public void randomIvPreventsRepeatedPlaintextCiphertextReuse() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();
        ProviderEnvelopeCrypto.Envelope a=f.instance().encrypt(TYPE,ID,TEXT),b=f.instance().encrypt(TYPE,ID,TEXT);
        assertFalse(Arrays.equals(a.iv(),b.iv()));assertFalse(Arrays.equals(a.ciphertext(),b.ciphertext()));
    }
    @Test public void returnedEnvelopeBytesCannotMutateSavedCiphertext() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();ProviderEnvelopeCrypto.Envelope e=f.instance().encrypt(TYPE,ID,TEXT);
        Arrays.fill(e.iv(),(byte)0);Arrays.fill(e.ciphertext(),(byte)0);assertArrayEquals(TEXT,f.instance().decrypt(TYPE,ID,e));
    }
    @Test public void tamperingFailsWithoutReplacingKeyOrChangingOriginalBytes() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();ProviderEnvelopeCrypto.Envelope e=f.instance().encrypt(TYPE,ID,TEXT);
        byte[] before=e.ciphertext(),bad=before.clone();bad[0]^=1;
        ProviderEnvelopeCrypto.Envelope changed=new ProviderEnvelopeCrypto.Envelope(e.iv(),bad);
        denied("custodial_provider_corrupt_preserved",()->f.instance().decrypt(TYPE,ID,changed));
        assertArrayEquals(before,e.ciphertext());assertEquals(1,f.keys.created);assertArrayEquals(TEXT,f.instance().decrypt(TYPE,ID,e));
    }
    @Test public void lostKeyNeverRegeneratesAndRetainedBytesStayUntouched() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();ProviderEnvelopeCrypto.Envelope e=f.instance().encrypt(TYPE,ID,TEXT);f.empty=false;
        byte[] before=e.ciphertext();f.keys.key=null;
        denied("custodial_provider_key_missing_preserved",()->f.instance().decrypt(TYPE,ID,e));
        denied("custodial_provider_key_missing_preserved",()->f.instance().initialize());
        assertEquals(1,f.keys.created);assertArrayEquals(before,e.ciphertext());
    }
    @Test public void unrelatedEnrollmentKeyDeletionCannotAffectSeparateKey() throws Exception {
        Fixture f=new Fixture();Keys enrollment=new Keys();enrollment.createInEmptyNamespace();f.instance().initialize();
        assertNotSame(enrollment.key,f.keys.key);ProviderEnvelopeCrypto.Envelope e=f.instance().encrypt(TYPE,ID,TEXT);
        enrollment.key=null;assertArrayEquals(TEXT,f.instance().decrypt(TYPE,ID,e));
    }
    @Test public void boundsAndInvalidUtf8FailWithoutMutatingInput() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();
        denied("custodial_provider_record_size_invalid",()->f.instance().encrypt(TYPE,ID,new char[0]));
        denied("custodial_provider_record_size_invalid",()->f.instance().encrypt(TYPE,ID,new char[ProviderEnvelopeCrypto.MAX_RECORD_BYTES+1]));
        char[] multi=new char[100000];Arrays.fill(multi,'\u20ac');
        denied("custodial_provider_record_size_invalid",()->f.instance().encrypt(TYPE,ID,multi));assertEquals('\u20ac',multi[0]);
        denied("custodial_provider_encrypt_failed_preserved",()->f.instance().encrypt(TYPE,ID,new char[]{'\ud800'}));
    }
    @Test public void boundarySizeIsAcceptedAndIdentityIsTyped() throws Exception {
        Fixture f=new Fixture();f.instance().initialize();char[] limit=new char[ProviderEnvelopeCrypto.MAX_RECORD_BYTES];Arrays.fill(limit,'a');
        assertArrayEquals(limit,f.instance().decrypt(TYPE,ID,f.instance().encrypt(TYPE,ID,limit)));
        for(String id:new String[]{"","x\0y","../x","x".repeat(129)})denied("custodial_provider_record_identity_invalid",()->f.instance().encrypt(TYPE,id,TEXT));
        denied("custodial_provider_record_identity_invalid",()->f.instance().encrypt(null,ID,TEXT));
    }
}
