package org.memphiszoo.custodial.sync

import java.nio.charset.StandardCharsets
import org.json.JSONObject
import org.memphiszoo.custodial.domain.CanonicalReceiptCommand
import org.memphiszoo.custodial.domain.LeaseToken

/** Accepts only the exact canonical receipt body and matching identity headers. */
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

        val receipt = parseCanonicalReceipt(response.body) ?: return null
        if (receipt.operationId != operationId) return null
        if (receipt.expectedPayloadSha256 != payloadHash) return null
        if (receipt.canonicalServerDigest != serverDigest) return null
        if (receipt.serverEffectId != effectId) return null
        if (receipt.acceptedAtEpochMs != acceptedAt) return null

        return CanonicalReceiptCommand(
            operationId = operation.operationId,
            expectedPayloadSha256 = operation.payloadSha256,
            canonicalReceiptBytes = response.body.copyOf(),
            canonicalServerDigest = serverDigest,
            serverEffectId = effectId,
            acceptedAtEpochMs = acceptedAt,
        )
    }

    private fun parseCanonicalReceipt(bytes: ByteArray): ReceiptBody? = runCatching {
        val source = bytes.toString(StandardCharsets.UTF_8)
        if (!source.toByteArray(StandardCharsets.UTF_8).contentEquals(bytes)) return null
        val value = JSONObject(source)
        val keys = mutableSetOf<String>()
        value.keys().forEachRemaining(keys::add)
        if (keys != RECEIPT_KEYS) return null
        val operationId = value.opt("operation_id") as? String ?: return null
        val payloadHash = value.opt("expected_payload_sha256") as? String ?: return null
        val serverDigest = value.opt("canonical_server_digest") as? String ?: return null
        val effectId = value.opt("server_effect_id") as? String ?: return null
        val accepted = value.opt("accepted_at_epoch_ms") as? Number ?: return null
        val replayed = value.opt("replayed") as? Boolean ?: return null
        val body = ReceiptBody(
            operationId = operationId,
            expectedPayloadSha256 = payloadHash,
            canonicalServerDigest = serverDigest,
            serverEffectId = effectId,
            acceptedAtEpochMs = accepted.toLong(),
            replayed = replayed,
        )
        if (!UUID.matches(body.operationId)) return null
        if (!SHA256.matches(body.expectedPayloadSha256)) return null
        if (!SHA256.matches(body.canonicalServerDigest)) return null
        if (body.serverEffectId.isBlank() || body.serverEffectId.length > 1_000) return null
        if (body.acceptedAtEpochMs <= 0L) return null
        if (!canonicalBytes(body).contentEquals(bytes)) return null
        body
    }.getOrNull()

    private fun canonicalBytes(value: ReceiptBody): ByteArray = buildString {
        append('{')
        append("\"operation_id\":").append(quote(value.operationId))
        append(",\"expected_payload_sha256\":").append(quote(value.expectedPayloadSha256))
        append(",\"canonical_server_digest\":").append(quote(value.canonicalServerDigest))
        append(",\"server_effect_id\":").append(quote(value.serverEffectId))
        append(",\"accepted_at_epoch_ms\":").append(value.acceptedAtEpochMs)
        append(",\"replayed\":").append(value.replayed)
        append('}')
    }.toByteArray(StandardCharsets.UTF_8)

    private fun quote(value: String): String = buildString(value.length + 2) {
        append('"')
        value.forEach { character ->
            when (character) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\b' -> append("\\b")
                '\u000C' -> append("\\f")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> if (character.code < 0x20) append("\\u%04x".format(character.code)) else append(character)
            }
        }
        append('"')
    }

    private data class ReceiptBody(
        val operationId: String,
        val expectedPayloadSha256: String,
        val canonicalServerDigest: String,
        val serverEffectId: String,
        val acceptedAtEpochMs: Long,
        val replayed: Boolean,
    )

    companion object {
        const val HEADER_OPERATION_ID = "X-Custodial-Operation-Id"
        const val HEADER_PAYLOAD_HASH = "X-Custodial-Payload-SHA256"
        const val HEADER_SERVER_DIGEST = "X-Custodial-Canonical-Server-Digest"
        const val HEADER_EFFECT_ID = "X-Custodial-Server-Effect-Id"
        const val HEADER_ACCEPTED_AT = "X-Custodial-Accepted-At-Epoch-Ms"
        private val UUID = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
        private val SHA256 = Regex("^[0-9a-f]{64}$")
        private val RECEIPT_KEYS = setOf(
            "operation_id",
            "expected_payload_sha256",
            "canonical_server_digest",
            "server_effect_id",
            "accepted_at_epoch_ms",
            "replayed",
        )
    }
}
