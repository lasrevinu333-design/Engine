package org.memphiszoo.custodial.sync

import org.memphiszoo.custodial.domain.CanonicalReceiptCommand
import org.memphiszoo.custodial.domain.LeaseToken

/**
 * Decodes an accepted operation only when every identity header binds the response to the
 * exact journal operation and exact request payload.
 */
class HeaderCanonicalReceiptDecoder : CanonicalReceiptDecoder {
    override fun decode(operation: LeaseToken, response: OperationHttpResponse): CanonicalReceiptCommand? {
        if (response.statusCode != 200 && response.statusCode != 201) return null
        if (response.body.isEmpty()) return null
        val operationId = response.header(HEADER_OPERATION_ID)?.trim() ?: return null
        val payloadHash = response.header(HEADER_PAYLOAD_HASH)?.trim()?.lowercase() ?: return null
        val serverDigest = response.header(HEADER_SERVER_DIGEST)?.trim()?.lowercase() ?: return null
        val effectId = response.header(HEADER_EFFECT_ID)?.trim() ?: return null
        val acceptedAt = response.header(HEADER_ACCEPTED_AT)?.trim()?.toLongOrNull() ?: return null
        if (operationId != operation.operationId) return null
        if (payloadHash != operation.payloadSha256.lowercase()) return null
        if (!SHA256.matches(serverDigest)) return null
        if (effectId.isBlank() || acceptedAt <= 0L) return null
        return CanonicalReceiptCommand(
            operationId = operation.operationId,
            expectedPayloadSha256 = operation.payloadSha256,
            canonicalReceiptBytes = response.body.copyOf(),
            canonicalServerDigest = serverDigest,
            serverEffectId = effectId,
            acceptedAtEpochMs = acceptedAt,
        )
    }

    companion object {
        const val HEADER_OPERATION_ID = "X-Custodial-Operation-Id"
        const val HEADER_PAYLOAD_HASH = "X-Custodial-Payload-SHA256"
        const val HEADER_SERVER_DIGEST = "X-Custodial-Canonical-Server-Digest"
        const val HEADER_EFFECT_ID = "X-Custodial-Server-Effect-Id"
        const val HEADER_ACCEPTED_AT = "X-Custodial-Accepted-At-Epoch-Ms"
        private val SHA256 = Regex("^[0-9a-f]{64}$")
    }
}
