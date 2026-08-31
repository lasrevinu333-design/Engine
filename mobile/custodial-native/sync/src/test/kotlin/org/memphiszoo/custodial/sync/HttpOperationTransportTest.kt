package org.memphiszoo.custodial.sync

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.memphiszoo.custodial.domain.LeaseToken
import org.memphiszoo.custodial.domain.OperationType
import org.memphiszoo.custodial.domain.ReconciliationKind

class HttpOperationTransportTest {
    @Test
    fun sendExactPreservesJournalBytesAndStableHeaders() = runBlocking {
        var captured: OperationHttpRequest? = null
        val transport = transport(
            client = OperationHttpClient { request ->
                captured = request
                OperationHttpResponse(statusCode = 202)
            },
        )
        val operation = operation()

        val result = transport.sendExact(operation)

        assertTrue(result is TransportOutcome.Ambiguous)
        val request = captured!!
        assertEquals("POST", request.method)
        assertEquals("https://example.invalid/scan-api/native-v1/operations/operation-a", request.url)
        assertFalse(request.headers.containsKey("Authorization"))
        assertEquals(operation.operationId, request.headers["Idempotency-Key"])
        assertEquals(operation.payloadSha256, request.headers["X-Custodial-Payload-SHA256"])
        assertArrayEquals(operation.canonicalRequestBytes, request.body)
        assertFalse(operation.canonicalRequestBytes === request.body)
    }

    @Test
    fun transportNeverSynthesizesCredentialHeaders() = runBlocking {
        var captured: OperationHttpRequest? = null
        val transport = transport(
            client = OperationHttpClient { request ->
                captured = request
                OperationHttpResponse(202)
            },
        )

        transport.sendExact(operation())

        assertFalse(captured!!.headers.keys.any { it.equals("Authorization", ignoreCase = true) })
        assertFalse(captured!!.headers.keys.any { it.contains("credential", ignoreCase = true) })
    }

    @Test
    fun canonicalStatusNotFoundReturnsRetryableForSafeResend() = runBlocking {
        var captured: OperationHttpRequest? = null
        val transport = transport(
            client = OperationHttpClient { request ->
                captured = request
                OperationHttpResponse(statusCode = 404, body = "not-found".toByteArray())
            },
        )

        val result = transport.readCanonicalStatus(operation(ReconciliationKind.READ_CANONICAL_STATUS))

        assertEquals("GET", captured?.method)
        assertNull(captured?.body)
        assertTrue(result is TransportOutcome.Retryable)
        assertEquals("CANONICAL_STATUS_NOT_FOUND", (result as TransportOutcome.Retryable).code)
    }

    @Test
    fun deterministicConflictCodesArePermanent() = runBlocking {
        val permanentCodes = listOf(
            "operation_id_mismatch",
            "body_operation_id_mismatch",
            "body_operation_type_mismatch",
            "payload_hash_mismatch",
            "idempotency_payload_mismatch",
            "operation_id_conflict",
            "identity_mismatch",
            "predecessor_mismatch",
            "predecessor_missing",
            "terminal_domain_conflict",
            "domain_unique_conflict",
        )
        permanentCodes.forEach { code ->
            val transport = transport(
                client = OperationHttpClient {
                    OperationHttpResponse(
                        statusCode = 409,
                        headers = mapOf("x-custodial-conflict-code" to code),
                    )
                },
            )

            val result = transport.sendExact(operation())

            assertTrue("$code must not enter status/resend recursion", result is TransportOutcome.PermanentConflict)
            assertEquals(code.uppercase(), (result as TransportOutcome.PermanentConflict).code)
        }
    }

    @Test
    fun unknownConflictStillRequiresCanonicalStatus() = runBlocking {
        val transport = transport(
            client = OperationHttpClient {
                OperationHttpResponse(
                    statusCode = 409,
                    headers = mapOf("x-custodial-conflict-code" to "future_transient_conflict"),
                )
            },
        )

        val result = transport.sendExact(operation())

        assertTrue(result is TransportOutcome.Ambiguous)
        assertEquals("OPERATION_CONFLICT_REQUIRES_STATUS", (result as TransportOutcome.Ambiguous).code)
    }

    @Test
    fun provenPreflightFailureIsRetryableButUnknownDeliveryIsAmbiguous() = runBlocking {
        val preflight = transport(client = OperationHttpClient { throw OperationRequestNotSentException("dns") })
        val unknown = transport(client = OperationHttpClient { throw OperationDeliveryUnknownException("socket closed") })

        val preflightResult = preflight.sendExact(operation())
        val unknownResult = unknown.sendExact(operation())

        assertTrue(preflightResult is TransportOutcome.Retryable)
        assertEquals("REQUEST_NOT_SENT", (preflightResult as TransportOutcome.Retryable).code)
        assertTrue(unknownResult is TransportOutcome.Ambiguous)
        assertEquals("DELIVERY_OUTCOME_UNKNOWN", (unknownResult as TransportOutcome.Ambiguous).code)
    }

    @Test
    fun retryAfterIsBounded() = runBlocking {
        val transport = transport(
            client = OperationHttpClient {
                OperationHttpResponse(statusCode = 429, headers = mapOf("Retry-After" to "999999"))
            },
        )

        val result = transport.sendExact(operation()) as TransportOutcome.Retryable

        assertEquals(3_600_000L, result.retryDelayMs)
    }

    private fun transport(client: OperationHttpClient) = HttpOperationTransport(
        configuration = configuration(),
        client = client,
        receiptDecoder = CanonicalReceiptDecoder { _, _ -> null },
        defaultRetryDelayMs = 5_000L,
    )

    private fun configuration() = OperationEndpointConfiguration("https://example.invalid")

    private fun operation(reconciliation: ReconciliationKind = ReconciliationKind.SEND_EXACT_BYTES) = LeaseToken(
        operationId = "operation-a",
        operationType = OperationType.START,
        canonicalRequestBytes = "{\"operationId\":\"operation-a\"}".toByteArray(),
        payloadSha256 = "payload-sha",
        reconciliationKind = reconciliation,
        leaseOwner = "worker-a",
        leaseGeneration = 1,
    )
}
