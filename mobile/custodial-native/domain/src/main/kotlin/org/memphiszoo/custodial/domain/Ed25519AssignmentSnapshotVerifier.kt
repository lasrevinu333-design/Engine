package org.memphiszoo.custodial.domain

import java.security.KeyFactory
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/** Verifies exact assignment bytes against a small pinned key set. */
class Ed25519AssignmentSnapshotVerifier private constructor(
    private val trustedKeys: Map<String, PublicKey>,
) : AssignmentSnapshotVerifier {
    override fun verify(candidate: AssignmentSnapshotCandidate): Boolean {
        if (candidate.signatureAlgorithm != ALGORITHM) return false
        if (candidate.canonicalBytes.isEmpty() || candidate.signatureBytes.isEmpty()) return false
        if (sha256(candidate.canonicalBytes) != candidate.snapshotDigest) return false
        if (sha256(candidate.signatureBytes) != candidate.signatureDigest) return false
        val key = trustedKeys[candidate.signingKeyId] ?: return false
        return runCatching {
            Signature.getInstance(ALGORITHM).run {
                initVerify(key)
                update(candidate.canonicalBytes)
                verify(candidate.signatureBytes)
            }
        }.getOrDefault(false)
    }

    companion object {
        const val ALGORITHM = "Ed25519"

        fun fromBase64X509(keys: Map<String, String>): Ed25519AssignmentSnapshotVerifier {
            val factory = KeyFactory.getInstance(ALGORITHM)
            val decoded = keys.mapValues { (_, encoded) ->
                factory.generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(encoded)))
            }
            require(decoded.isNotEmpty()) { "At least one assignment signing key is required." }
            return Ed25519AssignmentSnapshotVerifier(decoded)
        }

        fun keyId(publicKey: PublicKey): String = sha256(publicKey.encoded)

        fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString("") { "%02x".format(it) }
    }
}
