package org.memphiszoo.custodial.sync

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.memphiszoo.custodial.domain.LeaseToken
import org.memphiszoo.custodial.domain.OperationType
import org.memphiszoo.custodial.domain.ReconciliationKind

class HeaderCanonicalReceiptDecoderTest {
    private val decoder = HeaderCanonicalReceiptDecoder()

    @Test
    fun validReceiptIsBoundToExactOperationPayloadHeadersAndBody() {
        val operation = operation()
        val body = canonicalBody()
        val decoded = decoder.decode(operation, response(body = body))
        assertNotNull(decoded)
        decoded!!
        assertEquals(operation.operationId, decoded.operationId)
        assertEquals(operation.payloadSha256, decoded.expectedPayloadSha256)
        assertEquals(EFFECT, decoded.serverEffectId)
        assertEquals(ACCEPTED_AT, decoded.acceptedAtEpochMs)
        assertArrayEquals(body, decoded.canonicalReceiptBytes)
    }

    @Test
    fun mismatchedIdentityPayloadOrBodyIsRejected() {
        assertNull(decoder.decode(operation(), response(operationId = OTHER_OPERATION)))
        assertNull(decoder.decode(operation(), response(payloadHash = "f".repeat(64))))
        assertNull(decoder.decode(operation(), response(body = canonicalBody(effectId = "other-effect"))))
        assertNull(decoder.decode(operation(), response(body = canonicalBody(acceptedAt = ACCEPTED_AT + 1))))
    }

    @Test
    fun nonCanonicalOrMalformedReceiptIsRejected() {
        val reordered = "{\"replayed\":false,\"operation_id\":\"$OPERATION\",\"expected_payload_sha256\":\"${"a".repeat(64)}\",\"canonical_server_digest\":\"${"b".repeat(64)}\",\"server_effect_id\":\"$EFFECT\",\"accepted_at_epoch_ms\":$ACCEPTED_AT}".toByteArray()
        assertNull(decoder.decode(operation(), response(body = reordered)))
        assertNull(decoder.decode(operation(), response(serverDigest = "bad")))
        assertNull(decoder.decode(operation(), response(acceptedAt = "0")))
        assertNull(decoder.decode(operation(), response(body = byteArrayOf())))
        assertNull(decoder.decode(operation(), response(status = 202)))
    }

    private fun canonicalBody(
        operationId: String = OPERATION,
        payloadHash: String = "a".repeat(64),
        serverDigest: String = "b".repeat(64),
        effectId: String = EFFECT,
        acceptedAt: Long = ACCEPTED_AT,
        replayed: Boolean = false,
    ): ByteArray = "{\"operation_id\":\"$operationId\",\"expected_payload_sha256\":\"$payloadHash\",\"canonical_server_digest\":\"$serverDigest\",\"server_effect_id\":\"$effectId\",\"accepted_at_epoch_ms\":$acceptedAt,\"replayed\":$replayed}".toByteArray()

    private fun response(
        status: Int = 201,
        operationId: String = OPERATION,
        payloadHash: String = "a".repeat(64),
        serverDigest: String = "b".repeat(64),
        effectId: String = EFFECT,
        acceptedAt: String = ACCEPTED_AT.toString(),
        body: ByteArray = canonicalBody(),
    ) = OperationHttpResponse(
        statusCode = status,
        headers = mapOf(
            HeaderCanonicalReceiptDecoder.HEADER_OPERATION_ID to operationId,
            HeaderCanonicalReceiptDecoder.HEADER_PAYLOAD_HASH to payloadHash,
            HeaderCanonicalReceiptDecoder.HEADER_SERVER_DIGEST to serverDigest,
            HeaderCanonicalReceiptDecoder.HEADER_EFFECT_ID to effectId,
            HeaderCanonicalReceiptDecoder.HEADER_ACCEPTED_AT to acceptedAt,
        ),
        body = body,
    )

    private fun operation() = LeaseToken(
        operationId = OPERATION,
        operationType = OperationType.START,
        canonicalRequestBytes = "request".toByteArray(),
        payloadSha256 = "a".repeat(64),
        reconciliationKind = ReconciliationKind.SEND_EXACT_BYTES,
        leaseOwner = "worker",
        leaseGeneration = 1,
    )

    private companion object {
        const val OPERATION = "11111111-1111-4111-8111-111111111111"
        const val OTHER_OPERATION = "22222222-2222-4222-8222-222222222222"
        const val EFFECT = "session:11111111-1111-4111-8111-111111111111"
        const val ACCEPTED_AT = 1_800_000_000_000L
    }
}
