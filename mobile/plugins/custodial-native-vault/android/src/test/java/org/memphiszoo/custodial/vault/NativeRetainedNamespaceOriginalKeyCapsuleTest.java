package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import javax.crypto.Cipher;
import org.junit.Test;

/** TWO NEW original vault-key/HMAC coupling cases. Synthetic AES envelopes
 * and test credential ONLY, no Android Base64/key-store effect or old rerun. */
public final class NativeRetainedNamespaceOriginalKeyCapsuleTest {
    static byte[][] envelope(char[] credential,String aad,int key)throws Exception {
        byte[] clear=new String(credential).getBytes(StandardCharsets.UTF_8);
        try{Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,NativeRetainedNamespacePrivateCapsuleTest.key(key));
            cipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));return new byte[][]{cipher.doFinal(clear),cipher.getIV()};}
        finally{Arrays.fill(clear,(byte)0);}
    }
    @Test public void exactLoadedKeyMustDecryptOriginalVaultDomainAndValidateUnchangedOriginalWorkHmac()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;var stable=new NativeRetainedNamespaceCensusTest.Stable(f.x);
        try(var g=f.x.f.generation()){
            var work=(NativeRetainedWorkCapture)NativeRetainedNamespacePrivateCapsuleTest.field(g,"capture");
            char[] credential=f.x.f.batch.old.vaultCipher.decrypt(f.x.f.batch.old.persistence.current().secret);
            byte[][] encrypted=null;
            try{encrypted=envelope(credential,"org.memphiszoo.custodial.native-vault.snapshot.v2",1);
                NativeRetainedNamespacePrivateCapsule.requireOriginalVaultAndWorkKey(NativeRetainedNamespacePrivateCapsuleTest.key(1),encrypted[0],encrypted[1],work,f.x.f.principal);}
            finally{VaultValidation.wipe(credential);if(encrypted!=null)for(byte[] bytes:encrypted)Arrays.fill(bytes,(byte)0);}
            stable.check();
        }f.x.f.preserved();
    }
    @Test public void replacedKeyWrongVaultDomainAndSameCredentialIdWrongSecretRefuseOriginalAuthority()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation()){
            var work=(NativeRetainedWorkCapture)NativeRetainedNamespacePrivateCapsuleTest.field(g,"capture");
            char[] credential=f.x.f.batch.old.vaultCipher.decrypt(f.x.f.batch.old.persistence.current().secret);
            try{
                for(int kind=0;kind<3;kind++){
                    char[] input=credential.clone();if(kind==2)input[input.length-1]^=1;
                    byte[][] encrypted=envelope(input,kind==1?NativeRetainedNamespacePrivateCapsule.AAD_DOMAIN:"org.memphiszoo.custodial.native-vault.snapshot.v2",1);
                    final int variant=kind;
                    try{NativeRetainedNamespacePrivateCapsuleTest.denied(()->NativeRetainedNamespacePrivateCapsule.requireOriginalVaultAndWorkKey(
                        NativeRetainedNamespacePrivateCapsuleTest.key(variant==0?2:1),encrypted[0],encrypted[1],work,f.x.f.principal));}
                    finally{VaultValidation.wipe(input);for(byte[] bytes:encrypted)Arrays.fill(bytes,(byte)0);}
                }
            }finally{VaultValidation.wipe(credential);}
        }f.x.f.preserved();
    }
}
