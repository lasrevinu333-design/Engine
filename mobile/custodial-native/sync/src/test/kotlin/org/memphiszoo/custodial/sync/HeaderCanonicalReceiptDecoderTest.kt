package org.memphiszoo.custodial.sync

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.memphiszoo.custodial.domain.LeaseToken
import org.memphiszoo.custodial.domain.OperationType
import org.memphiszoo.custodial.domain.ReconciliationKind

class HeaderCanonicalReceiptDecoderTest {
    private val decoder = HeaderCanonicalReceiptDecoder()

    @Test
    fun validReceiptIsBoundToExactOperationAndPayload() {
        val operation = operation()
        val body = "{\"accepted\":true}".toByteArray()
        val decoded = decoder.decode(operation, response(body = body))
        assertNotNull(decoded)
        decoded!!
        assertEquals(operation.operationId, decoded.operationId)
        assertEquals(operation.payloadSha256, decoded.expectedPayloadSha256)
        assertEquals("effect-1", decoded.serverEffectId)
        assertEquals(1_800_000_000_000L, decoded.acceptedAtEpochMs)
        assertArrayEquals(body, decoded.canonicalReceiptBytes)
        assertArrayEquals(body, response(body = body).body)
    }

    @Test
    fun mismatchedIdentityOrPayloadIsRejected() {
        assertNull(decoder.decode(operation(), response(operationId = "other")))
        assertNull(decoder.decode(operation(), response(payloadHash = "f".repeat(64))))
    }

    @Test
    fun malformedReceiptIsRejected() {
        assertNull(decoder.decode(operation(), response(serverDigest = "bad")))
        assertNull(decoder.decode(operation(), response(acceptedAt = "0")))
        assertNull(decoder.decode(operation(), response(body = byteArrayOf())))
        assertNull(decoder.decode(operation(), response(status = 202)))
    }

    private fun response(
        status: Int = 201,
        operationId: String = "operation-a",
        payloadHash: String = "a".repeat(64),
        serverDigest: String = "b".repeat(64),
        acceptedAt: String = "1800000000000",
        body: ByteArray = "receipt".toByteArray(),
    ) = OperationHttpResponse(
        statusCode = status,
        headers = mapOf(
            HeaderCanonicalReceiptDecoder.HEADER_OPERATION_ID to operationId,
            HeaderCanonicalReceiptDecoder.HEADER_PAYLOAD_HASH to payloadHash,
            HeaderCanonicalReceiptDecoder.HEADER_SERVER_DIGEST to serverDigest,
            HeaderCanonicalReceiptDecoder.HEADER_EFFECT_ID to "effect-1",
            HeaderCanonicalReceiptDecoder.HEADER_ACCEPTED_AT to acceptedAt,
        ),
        body = body,
    )

    private fun operation() = LeaseToken(
        operationId = "operation-a",
        operationType = OperationType.START,
        canonicalRequestBytes = "request".toByteArray(),
        payloadSha256 = "a".repeat(64),
        reconciliationKind = ReconciliationKind.SEND_EXACT_BYTES,
        leaseOwner = "worker",
        leaseGeneration = 1,
    )
}
