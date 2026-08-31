package org.memphiszoo.custodial.domain

import com.google.crypto.tink.subtle.Ed25519Verify
import java.security.MessageDigest
import java.security.PublicKey
import java.util.Base64

/** Verifies exact assignment bytes against a small pinned Ed25519 key set. */
class Ed25519AssignmentSnapshotVerifier private constructor(
    private val trustedKeys: Map<String, Ed25519Verify>,
) : AssignmentSnapshotVerifier {
    override fun verify(candidate: AssignmentSnapshotCandidate): Boolean {
        if (candidate.signatureAlgorithm != ALGORITHM) return false
        if (candidate.canonicalBytes.isEmpty() || candidate.signatureBytes.isEmpty()) return false
        if (sha256(candidate.canonicalBytes) != candidate.snapshotDigest) return false
        if (sha256(candidate.signatureBytes) != candidate.signatureDigest) return false
        val verifier = trustedKeys[candidate.signingKeyId] ?: return false
        return runCatching {
            verifier.verify(candidate.signatureBytes, candidate.canonicalBytes)
            true
        }.getOrDefault(false)
    }

    companion object {
        const val ALGORITHM = "Ed25519"
        private const val RAW_PUBLIC_KEY_BYTES = 32
        private val X509_PREFIX = byteArrayOf(
            0x30, 0x2a, 0x30, 0x05, 0x06, 0x03,
            0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
        )

        fun fromBase64X509(keys: Map<String, String>): Ed25519AssignmentSnapshotVerifier {
            require(keys.isNotEmpty()) { "At least one assignment signing key is required." }
            val decoded = keys.mapValues { (_, encoded) ->
                Ed25519Verify(rawPublicKey(Base64.getDecoder().decode(encoded)))
            }
            return Ed25519AssignmentSnapshotVerifier(decoded)
        }

        private fun rawPublicKey(x509: ByteArray): ByteArray {
            require(x509.size == X509_PREFIX.size + RAW_PUBLIC_KEY_BYTES) {
                "The assignment signing key is not a canonical Ed25519 X.509 public key."
            }
            require(x509.copyOfRange(0, X509_PREFIX.size).contentEquals(X509_PREFIX)) {
                "The assignment signing key uses an unexpected X.509 algorithm or encoding."
            }
            return x509.copyOfRange(X509_PREFIX.size, x509.size)
        }

        fun keyId(publicKey: PublicKey): String = sha256(publicKey.encoded)

        fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString("") { "%02x".format(it) }
    }
}
