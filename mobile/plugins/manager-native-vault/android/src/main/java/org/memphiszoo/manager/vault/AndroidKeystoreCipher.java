package org.memphiszoo.manager.vault;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** AndroidKeyStore AES-GCM adapter; plaintext is never written to preferences. */
final class AndroidKeystoreCipher implements CredentialCipher {
    static final String KEY_ALIAS = "org.memphiszoo.manager.native-vault.v2";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final byte[] AAD = "org.memphiszoo.manager.native-vault.snapshot.v2".getBytes(StandardCharsets.UTF_8);

    private KeyStore keyStore;

    @Override
    public synchronized EncryptedSecret encrypt(char[] cleartext) throws VaultFailure {
        if (cleartext == null || cleartext.length == 0 || cleartext.length > 4096) {
            throw new VaultFailure("manager_native_credential_missing");
        }
        byte[] clear = encode(cleartext);
        byte[] encrypted = null;
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            cipher.updateAAD(AAD);
            encrypted = cipher.doFinal(clear);
            return new EncryptedSecret(
                Base64.encodeToString(encrypted, Base64.NO_WRAP),
                Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("manager_native_vault_encrypt_failed", error);
        } finally {
            Arrays.fill(clear, (byte) 0);
            if (encrypted != null) Arrays.fill(encrypted, (byte) 0);
        }
    }

    @Override
    public synchronized char[] decrypt(EncryptedSecret secret) throws VaultFailure {
        if (secret == null) throw new VaultFailure("manager_native_credential_missing");
        byte[] encrypted = null;
        byte[] iv = null;
        byte[] clear = null;
        try {
            encrypted = Base64.decode(secret.ciphertext, Base64.NO_WRAP);
            iv = Base64.decode(secret.iv, Base64.NO_WRAP);
            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) store().getEntry(KEY_ALIAS, null);
            if (entry == null) throw new VaultFailure("manager_native_vault_key_missing");
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, entry.getSecretKey(), new GCMParameterSpec(128, iv));
            cipher.updateAAD(AAD);
            clear = cipher.doFinal(encrypted);
            return decode(clear);
        } catch (VaultFailure error) {
            throw error;
        } catch (IllegalArgumentException error) {
            throw new VaultFailure("manager_native_vault_corrupt", error);
        } catch (Exception error) {
            throw new VaultFailure("manager_native_vault_decrypt_failed", error);
        } finally {
            if (encrypted != null) Arrays.fill(encrypted, (byte) 0);
            if (iv != null) Arrays.fill(iv, (byte) 0);
            if (clear != null) Arrays.fill(clear, (byte) 0);
        }
    }

    @Override
    public synchronized void destroyKey() throws VaultFailure {
        try {
            KeyStore store = store();
            if (store.containsAlias(KEY_ALIAS)) store.deleteEntry(KEY_ALIAS);
        } catch (Exception error) {
            throw new VaultFailure("manager_native_vault_key_cleanup_failed", error);
        }
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) store().getEntry(KEY_ALIAS, null);
        if (entry != null) return entry.getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build());
        return generator.generateKey();
    }

    private KeyStore store() throws Exception {
        if (keyStore == null) {
            keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
        }
        return keyStore;
    }

    private static byte[] encode(char[] value) throws VaultFailure {
        try {
            ByteBuffer buffer = StandardCharsets.UTF_8.newEncoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .encode(CharBuffer.wrap(value));
            byte[] result = new byte[buffer.remaining()];
            buffer.get(result);
            if (buffer.hasArray()) Arrays.fill(buffer.array(), (byte) 0);
            return result;
        } catch (CharacterCodingException error) {
            throw new VaultFailure("manager_native_vault_encrypt_failed", error);
        }
    }

    private static char[] decode(byte[] value) throws VaultFailure {
        try {
            CharBuffer buffer = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(value));
            char[] result = new char[buffer.remaining()];
            buffer.get(result);
            if (buffer.hasArray()) Arrays.fill(buffer.array(), '\0');
            return result;
        } catch (CharacterCodingException error) {
            throw new VaultFailure("manager_native_vault_corrupt", error);
        }
    }
}
