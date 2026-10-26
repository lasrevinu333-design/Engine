package org.memphiszoo.custodial.vault;

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
    static final String KEY_ALIAS = "org.memphiszoo.custodial.native-vault.v2";
    private static final int DEFAULT_MAX_CLEARTEXT_CHARACTERS = 4_096;
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final byte[] VAULT_SNAPSHOT_AAD = "org.memphiszoo.custodial.native-vault.snapshot.v2".getBytes(StandardCharsets.UTF_8);

    private KeyStore keyStore;
    private final byte[] aad;
    private final int maxCleartextCharacters;

    AndroidKeystoreCipher() {
        this(VAULT_SNAPSHOT_AAD, DEFAULT_MAX_CLEARTEXT_CHARACTERS);
    }

    /** Uses the same device-bound key with a distinct authenticated data domain. */
    AndroidKeystoreCipher(String aadDomain) {
        this(aadDomain, DEFAULT_MAX_CLEARTEXT_CHARACTERS);
    }

    /** Binds a distinct authenticated data domain to an explicitly bounded record class. */
    AndroidKeystoreCipher(String aadDomain, int maxCleartextCharacters) {
        this(
            aadDomain == null ? new byte[0] : aadDomain.getBytes(StandardCharsets.UTF_8),
            maxCleartextCharacters
        );
    }

    private AndroidKeystoreCipher(byte[] aad, int maxCleartextCharacters) {
        if (maxCleartextCharacters < 1) throw new IllegalArgumentException("maxCleartextCharacters must be positive");
        this.aad = Arrays.copyOf(aad, aad.length);
        this.maxCleartextCharacters = maxCleartextCharacters;
    }

    @Override
    public EncryptedSecret encrypt(char[] cleartext) throws VaultFailure {
        // The only key-creating path takes WORK before the cipher monitor.
        // Existing-key-only/retained readers never acquire WORK from here.
        synchronized (AndroidProtectedWorkPreferences.retainedCommitLock()) {
            synchronized (this) { return encrypt(cleartext, false); }
        }
    }

    @Override
    public synchronized EncryptedSecret encryptWithExistingKey(char[] cleartext) throws VaultFailure {
        return encrypt(cleartext, true);
    }

    private EncryptedSecret encrypt(char[] cleartext, boolean existingKeyOnly) throws VaultFailure {
        if (cleartext == null || cleartext.length == 0) {
            throw new VaultFailure("custodial_native_credential_missing");
        }
        if (cleartext.length > maxCleartextCharacters) {
            throw new VaultFailure("custodial_native_vault_plaintext_too_large");
        }
        byte[] clear = encode(cleartext);
        byte[] encrypted = null;
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            // The recovery branch obtains the actual existing key, not a racy
            // containsAlias preflight followed by the key-creating operation.
            SecretKey key = existingKeyOnly ? requireExistingKey() : getOrCreateKey();
            cipher.init(Cipher.ENCRYPT_MODE, key);
            cipher.updateAAD(aad);
            encrypted = cipher.doFinal(clear);
            return new EncryptedSecret(
                Base64.encodeToString(encrypted, Base64.NO_WRAP),
                Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP),
                Math.max(16_384,4*maxCleartextCharacters+64)
            );
        } catch (VaultFailure error) {
            throw error;
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_vault_encrypt_failed", error);
        } finally {
            Arrays.fill(clear, (byte) 0);
            if (encrypted != null) Arrays.fill(encrypted, (byte) 0);
        }
    }

    @Override
    public synchronized char[] decrypt(EncryptedSecret secret) throws VaultFailure {
        if (secret == null) throw new VaultFailure("custodial_native_credential_missing");
        byte[] encrypted = null;
        byte[] iv = null;
        byte[] clear = null;
        try {
            encrypted = Base64.decode(secret.ciphertext, Base64.NO_WRAP);
            iv = Base64.decode(secret.iv, Base64.NO_WRAP);
            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) store().getEntry(KEY_ALIAS, null);
            if (entry == null) throw new VaultFailure("custodial_native_vault_key_missing");
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, entry.getSecretKey(), new GCMParameterSpec(128, iv));
            cipher.updateAAD(aad);
            clear = cipher.doFinal(encrypted);
            return decode(clear);
        } catch (VaultFailure error) {
            throw error;
        } catch (IllegalArgumentException error) {
            throw new VaultFailure("custodial_native_vault_corrupt", error);
        } catch (Exception error) {
            throw new VaultFailure("custodial_native_vault_decrypt_failed", error);
        } finally {
            if (encrypted != null) Arrays.fill(encrypted, (byte) 0);
            if (iv != null) Arrays.fill(iv, (byte) 0);
            if (clear != null) Arrays.fill(clear, (byte) 0);
        }
    }

    @Override
    public synchronized void destroyKey() throws VaultFailure {
        // This alias also protects retained offline authority/work records.
        // Different AAD domains do not make it an enrollment-only key. Neither
        // a remote removal tombstone nor an empty browser queue proves that all
        // native ciphertext has been retired. Refuse before any key-store access;
        // VaultEngine must retain the exact pending tombstone, not finalize EMPTY.
        // Safe purpose-specific retirement requires a separately reviewed owner
        // and existing-data recovery contract; never rotate/delete this key here.
        throw new VaultFailure("custodial_native_shared_key_retirement_refused");
    }

    /** UNMOUNTED fixed all8 capsule adapter. Existing shared-V2 key ONLY;
     * no create fallback, exported key, caller cipher/domain or storage write. */
    synchronized NativeRetainedNamespacePrivateCapsule preparePrivateNamespaceCapsule(
        NativeRetainedNamespaceValues values, byte[] original, NativeRetainedNamespaceCustodyLayout.Observation layout,
        VaultSnapshot vault, NativeRetainedWorkCapture frozenWork, NativeProviderPrincipal principal) throws VaultFailure {
        try {
            SecretKey key = requireExistingKey();
            requireOriginalVaultAndWorkWithKey(key, vault.secret, frozenWork, principal);
            return NativeRetainedNamespacePrivateCapsule.prepare(values, original, layout, key);
        }
        catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(NativeRetainedNamespacePrivateCapsule.FAILURE); }
    }

    synchronized void verifyPrivateNamespaceCapsule(NativeRetainedNamespacePrivateCapsule capsule,
        NativeRetainedNamespaceValues values, byte[] original, NativeRetainedNamespaceCustodyLayout.Observation layout,
        VaultSnapshot vault, NativeRetainedWorkCapture frozenWork, NativeProviderPrincipal principal) throws VaultFailure {
        try {
            SecretKey key = requireExistingKey();
            requireOriginalVaultAndWorkWithKey(key, vault.secret, frozenWork, principal);
            capsule.verify(values, original, layout, key);
        }
        catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(NativeRetainedNamespacePrivateCapsule.FAILURE); }
    }

    /** Fixed same-device restore ONLY. Reuses original encrypted record and
     * loaded original key; never creates a key/capsule/IV or applies raw rows. */
    synchronized NativeRetainedNamespacePrivateCapsule restorePrivateNamespaceCapsule(
        NativeRetainedNamespaceValues values, byte[] original, NativeRetainedNamespaceCustodyLayout.Observation layout,
        NativeRetainedNamespacePrivateCapsule.SavedLocalRecord record, VaultSnapshot vault,
        NativeRetainedWorkCapture frozenWork, NativeProviderPrincipal principal) throws VaultFailure {
        try {
            SecretKey key = requireExistingKey();
            requireOriginalVaultAndWorkWithKey(key, vault.secret, frozenWork, principal);
            return NativeRetainedNamespacePrivateCapsule.restoreSavedLocalRecord(values, original, layout, record, key);
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(NativeRetainedNamespacePrivateCapsule.FAILURE); }
    }

    synchronized void requireOriginalNamespaceCustodyKey(VaultSnapshot vault,
        NativeRetainedWorkCapture frozenWork, NativeProviderPrincipal principal) throws VaultFailure {
        try { requireOriginalVaultAndWorkWithKey(requireExistingKey(), vault.secret, frozenWork, principal); }
        catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(NativeRetainedNamespacePrivateCapsule.FAILURE); }
    }

    /** The exact loaded key must decrypt the ORIGINAL vault-AAD snapshot
     * credential AND verify the original frozen WORK HMAC. Merely finding a
     * replacement key under the same alias is not same-original-key proof.
     * No credential is returned; no HMAC/signature is refreshed. */
    private static void requireOriginalVaultAndWorkWithKey(SecretKey key, EncryptedSecret secret,
        NativeRetainedWorkCapture frozenWork, NativeProviderPrincipal principal) throws VaultFailure {
        byte[] encrypted = null, iv = null;
        try {
            if (key == null || secret == null || frozenWork == null || principal == null) throw new VaultFailure(NativeRetainedNamespacePrivateCapsule.FAILURE);
            encrypted = Base64.decode(secret.ciphertext, Base64.NO_WRAP); iv = Base64.decode(secret.iv, Base64.NO_WRAP);
            NativeRetainedNamespacePrivateCapsule.requireOriginalVaultAndWorkKey(key, encrypted, iv, frozenWork, principal);
        } catch (Exception error) { throw new VaultFailure(NativeRetainedNamespacePrivateCapsule.FAILURE); }
        finally {
            if (encrypted != null) Arrays.fill(encrypted, (byte) 0);
            if (iv != null) Arrays.fill(iv, (byte) 0);
        }
    }

    private SecretKey requireExistingKey() throws Exception {
        KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) store().getEntry(KEY_ALIAS, null);
        if (entry == null) throw new VaultFailure("custodial_native_vault_key_missing");
        return entry.getSecretKey();
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) store().getEntry(KEY_ALIAS, null);
        if (entry != null) return entry.getSecretKey();
        AndroidProtectedWorkPreferences.requireUnjournaledInitialSharedKeyCreation();
        // Recheck the fixed alias while retaining the SAME coordinator and
        // cipher monitor; never overwrite a concurrently supplied old key.
        entry = (KeyStore.SecretKeyEntry) store().getEntry(KEY_ALIAS, null);
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
            throw new VaultFailure("custodial_native_vault_encrypt_failed", error);
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
            throw new VaultFailure("custodial_native_vault_corrupt", error);
        }
    }
}
