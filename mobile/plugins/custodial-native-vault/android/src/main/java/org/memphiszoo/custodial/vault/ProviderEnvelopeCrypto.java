package org.memphiszoo.custodial.vault;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Provider-only envelope primitive. It never handles enrollment credentials. */
final class ProviderEnvelopeCrypto implements ProviderRecordStore.Crypto {
    static final String SCHEMA = "custodial.provider-envelope.v1";
    static final int MAX_RECORD_BYTES = 256 * 1024;
    enum Domain { METADATA, TOKEN, GENERATION, INBOX, QUARANTINE, EVENT, TOMBSTONE }

    /** Production supplies only the fixed provider alias; no deletion API. */
    interface Keys {
        SecretKey existing() throws Exception;
        SecretKey createInEmptyNamespace() throws Exception;
    }
    interface Namespace { boolean isEmpty() throws Exception; }
    static final class Envelope {
        private final byte[] iv;
        private final byte[] ciphertext;
        Envelope(byte[] iv, byte[] ciphertext) throws VaultFailure {
            if (iv == null || iv.length != 12 || ciphertext == null
                || ciphertext.length < 17 || ciphertext.length > MAX_RECORD_BYTES + 16) {
                throw new VaultFailure("custodial_provider_envelope_invalid");
            }
            this.iv = iv.clone(); this.ciphertext = ciphertext.clone();
        }
        byte[] iv() { return iv.clone(); }
        byte[] ciphertext() { return ciphertext.clone(); }
    }

    private final Keys keys;
    private final Namespace namespace;
    private final Object storeLock;

    ProviderEnvelopeCrypto(Keys keys, Namespace namespace, Object storeLock) {
        if (keys == null || namespace == null || storeLock == null) throw new IllegalArgumentException("provider_crypto_dependencies_required");
        this.keys = keys; this.namespace = namespace; this.storeLock = storeLock;
    }

    /** Called by the native store under the SAME namespace lock as commits. */
    @Override public void initialize() throws VaultFailure {
        synchronized (storeLock) {
            try {
                if (keys.existing() != null) return;
                if (!namespace.isEmpty()) throw new VaultFailure("custodial_provider_key_missing_preserved");
                SecretKey created = keys.createInEmptyNamespace();
                if (created == null || keys.existing() == null) throw new VaultFailure("custodial_provider_key_creation_failed");
            } catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure("custodial_provider_key_unavailable_preserved", error); }
        }
    }

    @Override public Envelope encrypt(Domain domain, String recordId, char[] value) throws VaultFailure {
        byte[] aad = aad(domain, recordId);
        if (value == null || value.length == 0 || value.length > MAX_RECORD_BYTES) throw new VaultFailure("custodial_provider_record_size_invalid");
        byte[] clear = null; byte[] encrypted = null;
        synchronized (storeLock) {
            try {
                clear = encode(value);
                if (clear.length > MAX_RECORD_BYTES) throw new VaultFailure("custodial_provider_record_size_invalid");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, requireKey());
                cipher.updateAAD(aad); encrypted = cipher.doFinal(clear);
                return new Envelope(cipher.getIV(), encrypted);
            } catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure("custodial_provider_encrypt_failed_preserved", error); }
            finally { wipe(clear); wipe(encrypted); wipe(aad); }
        }
    }

    @Override public char[] decrypt(Domain domain, String recordId, Envelope envelope) throws VaultFailure {
        byte[] aad = aad(domain, recordId);
        if (envelope == null) throw new VaultFailure("custodial_provider_envelope_invalid");
        byte[] clear = null;
        synchronized (storeLock) {
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, requireKey(), new GCMParameterSpec(128, envelope.iv));
                cipher.updateAAD(aad); clear = cipher.doFinal(envelope.ciphertext);
                if (clear.length == 0 || clear.length > MAX_RECORD_BYTES) throw new VaultFailure("custodial_provider_record_size_invalid");
                CharBuffer decoded = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(clear));
                try { char[] result = new char[decoded.remaining()]; decoded.get(result); return result; }
                finally { if (decoded.hasArray()) Arrays.fill(decoded.array(), '\0'); }
            } catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure("custodial_provider_corrupt_preserved", error); }
            finally { wipe(clear); wipe(aad); }
        }
    }

    private SecretKey requireKey() throws Exception {
        SecretKey key = keys.existing();
        if (key == null) throw new VaultFailure("custodial_provider_key_missing_preserved");
        return key; // NEVER create a replacement while reading or writing.
    }
    private static byte[] aad(Domain domain, String id) throws VaultFailure {
        if (domain == null || id == null || !id.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) {
            throw new VaultFailure("custodial_provider_record_identity_invalid");
        }
        return (SCHEMA + "\0" + domain.name() + "\0" + id).getBytes(StandardCharsets.UTF_8);
    }
    private static byte[] encode(char[] value) throws Exception {
        ByteBuffer encoded = StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).encode(CharBuffer.wrap(value));
        try { byte[] result = new byte[encoded.remaining()]; encoded.get(result); return result; }
        finally { if (encoded.hasArray()) Arrays.fill(encoded.array(), (byte) 0); }
    }
    private static void wipe(byte[] bytes) { if (bytes != null) Arrays.fill(bytes, (byte) 0); }
}
